import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Customer,
  LedgerTransaction,
  SyncQueueItem,
  SyncState,
} from '../types/customer';

const OUTBOX_STORAGE_KEY = '@gwd_book:sync_outbox_v1';
const LAST_SYNCED_KEY = '@gwd_book:last_synced_at_v1';

class SyncEngine {
  private state: SyncState = {
    status: 'idle',
    pendingCount: 0,
    lastSyncedAt: null,
    errorMessage: null,
  };

  private listeners = new Set<(state: SyncState) => void>();
  private isOnline = true;
  private isSyncing = false;
  private syncPendingAfterCurrent = false;
  private syncDebounceTimer: any = null;
  private netInfoUnsubscribe: (() => void) | null = null;
  private realtimeChannel: any = null;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      // 1. Load last synced time
      const savedLastSynced = await AsyncStorage.getItem(LAST_SYNCED_KEY);
      const outbox = await this.getOutbox();

      this.state = {
        ...this.state,
        lastSyncedAt: savedLastSynced,
        pendingCount: outbox.length,
      };
      this.notify();

      // 2. Listen to network connectivity
      this.netInfoUnsubscribe = NetInfo.addEventListener((netState: NetInfoState) => {
        const online = Boolean(netState.isConnected && netState.isInternetReachable !== false);
        const wasOffline = !this.isOnline && online;
        this.isOnline = online;

        if (!online) {
          this.updateState({ status: 'offline' });
        } else if (wasOffline) {
          // Came back online: trigger sync automatically
          this.triggerDebouncedSync(200);
        }
      });

      // 3. Initial check and auto-sync on app start
      const currentNet = await NetInfo.fetch();
      this.isOnline = Boolean(currentNet.isConnected && currentNet.isInternetReachable !== false);
      if (!this.isOnline) {
        this.updateState({ status: 'offline' });
      } else if (isSupabaseConfigured()) {
        // Automatically sync on engine startup if online
        this.triggerDebouncedSync(300);
      }
    } catch (err) {
      console.warn('SyncEngine init failed:', err);
    }
  }

  public destroy() {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = null;
    }
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
    }
    if (this.realtimeChannel) {
      try {
        supabase.removeChannel(this.realtimeChannel);
      } catch {}
      this.realtimeChannel = null;
    }
    this.listeners.clear();
  }

  public getState(): SyncState {
    return { ...this.state };
  }

  public subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(currentState);
      } catch (e) {
        console.warn('Sync listener error:', e);
      }
    }
  }

  private updateState(partial: Partial<SyncState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  // ============================================================================
  // OUTBOX MANAGEMENT (Local Idempotent Write Queue)
  // ============================================================================

  public async getOutbox(): Promise<SyncQueueItem[]> {
    try {
      const raw = await AsyncStorage.getItem(OUTBOX_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private async saveOutbox(items: SyncQueueItem[]): Promise<void> {
    await AsyncStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(items));
    this.updateState({ pendingCount: items.length });
  }

  public triggerDebouncedSync(delayMs = 80): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.syncDebounceTimer = setTimeout(() => {
      this.syncDebounceTimer = null;
      this.syncNow();
    }, delayMs);
  }

  public async addToOutbox(
    item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retryCount'>
  ): Promise<void> {
    const queueItem: SyncQueueItem = {
      ...item,
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    const outbox = await this.getOutbox();
    // Prevent duplicate entries for the same record and action
    const filtered = outbox.filter(
      (existing) =>
        !(existing.recordId === queueItem.recordId && existing.action === queueItem.action)
    );
    filtered.push(queueItem);
    await this.saveOutbox(filtered);

    // If online and Supabase is configured, trigger debounced sync immediately
    if (this.isOnline && isSupabaseConfigured()) {
      this.triggerDebouncedSync(80);
    }
  }

  public async clearOutbox(): Promise<void> {
    await AsyncStorage.removeItem(OUTBOX_STORAGE_KEY);
    this.updateState({ pendingCount: 0 });
  }

  // ============================================================================
  // SYNC EXECUTION (Push pending writes -> Pull remote changes)
  // ============================================================================

  public async syncNow(): Promise<void> {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = null;
    }

    if (this.isSyncing) {
      this.syncPendingAfterCurrent = true;
      return;
    }

    if (!this.isOnline) {
      this.updateState({ status: 'offline' });
      return;
    }

    if (!isSupabaseConfigured()) {
      // Offline mode by configuration
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      // User is not logged in to cloud: Keep pending writes safe locally
      return;
    }

    const userId = authData.user.id;
    this.isSyncing = true;
    this.updateState({ status: 'syncing', errorMessage: null });

    // Ensure Realtime channel is connected to receive instant remote changes
    if (!this.realtimeChannel) {
      this.setupRealtimeSubscription(userId);
    }

    try {
      // 1. Drain Outbox (Push)
      await this.pushPendingWrites(userId);

      // 2. Fetch Remote Updates (Pull)
      await this.pullRemoteUpdates(userId);

      // 3. Mark success
      const now = new Date().toISOString();
      await AsyncStorage.setItem(LAST_SYNCED_KEY, now);
      this.updateState({
        status: 'synced',
        lastSyncedAt: now,
        errorMessage: null,
      });
    } catch (err: any) {
      console.warn('Sync failed:', err);
      this.updateState({
        status: 'error',
        errorMessage: err?.message || 'Sync failed due to network error',
      });
    } finally {
      this.isSyncing = false;
      if (this.syncPendingAfterCurrent) {
        this.syncPendingAfterCurrent = false;
        this.triggerDebouncedSync(50);
      }
    }
  }

  private async pushPendingWrites(userId: string): Promise<void> {
    const outbox = await this.getOutbox();
    if (outbox.length === 0) return;

    const remainingItems: SyncQueueItem[] = [];

    for (const item of outbox) {
      try {
        if (item.action === 'delete') {
          if (item.entity === 'customer') {
            const { error } = await supabase
              .from('customers')
              .delete()
              .eq('id', item.recordId)
              .eq('business_id', userId);
            if (error) throw error;
          } else if (item.entity === 'transaction') {
            const { error } = await supabase
              .from('ledger_transactions')
              .delete()
              .eq('id', item.recordId)
              .eq('business_id', userId);
            if (error) throw error;
          }
        } else if (item.entity === 'customer') {
          const cust = item.payload as Customer;
          const { error } = await supabase.from('customers').upsert(
            {
              id: cust.id,
              business_id: userId,
              name: cust.name,
              phone: cust.phone || null,
              address: cust.address || null,
              is_active: !cust.isArchived,
              created_at: cust.createdAt,
              updated_at: cust.updatedAt || cust.createdAt,
            },
            { onConflict: 'id' }
          );

          if (error) throw error;
        } else if (item.entity === 'transaction') {
          const tx = item.payload as LedgerTransaction;
          const isOpening = Boolean(
            tx.isOpeningBalance ||
            tx.description?.toLowerCase().includes('opening') ||
            tx.id.includes('init')
          );
          const { error } = await supabase.from('ledger_transactions').upsert(
            {
              id: tx.id,
              business_id: userId,
              customer_id: tx.customerId,
              type: tx.type,
              amount_paise: tx.amountPaise,
              description: tx.type === 'GAVE' ? null : (tx.description || null),
              transaction_date: tx.date,
              is_opening_balance: isOpening,
              is_void: Boolean(tx.isVoided),
              void_reason: tx.voidReason || null,
              created_at: tx.createdAt,
              updated_at: tx.updatedAt || tx.createdAt,
            },
            { onConflict: 'id' }
          );

          if (error) throw error;
        }
      } catch (err: any) {
        console.warn(`Error syncing outbox item ${item.id}:`, err);
        // Exponential backoff / retry counter
        item.retryCount += 1;
        item.lastAttemptAt = new Date().toISOString();
        item.errorMessage = err?.message || 'Failed';
        remainingItems.push(item);
      }
    }

    await this.saveOutbox(remainingItems);
  }

  private async pullRemoteUpdates(userId: string): Promise<void> {
    try {
      // 1. Pull remote customers
      const { data: remoteCustomers, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', userId);

      if (custError) throw custError;

      // 2. Pull remote transactions
      const { data: remoteTransactions, error: txError } = await supabase
        .from('ledger_transactions')
        .select('*')
        .eq('business_id', userId)
        .order('created_at', { ascending: true });

      if (txError) throw txError;

      // Import into local repository (always reconcile deletions even if empty)
      if (this.onRemoteDataMerged) {
        await this.onRemoteDataMerged(remoteCustomers || [], remoteTransactions || []);
      }
    } catch (err) {
      console.warn('Error pulling remote updates:', err);
    }
  }

  // Set up live Realtime websocket subscription for cross-device synchronization
  public setupRealtimeSubscription(userId?: string): void {
    if (!isSupabaseConfigured()) return;
    if (this.realtimeChannel) {
      try {
        supabase.removeChannel(this.realtimeChannel);
      } catch {}
      this.realtimeChannel = null;
    }

    try {
      this.realtimeChannel = supabase
        .channel('public:realtime_ledger_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ledger_transactions' },
          () => {
            // Instant reflection: when another device adds or deletes a transaction, sync immediately!
            if (!this.isSyncing) {
              this.syncNow();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'customers' },
          () => {
            // Instant reflection: when another device adds or deletes a customer, sync immediately!
            if (!this.isSyncing) {
              this.syncNow();
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Failed to setup Realtime subscription:', e);
    }
  }

  // Callback to merge remote data into local repository
  public onRemoteDataMerged?: (
    remoteCustomers: any[],
    remoteTransactions: any[]
  ) => Promise<void>;
}

export const syncEngine = new SyncEngine();
