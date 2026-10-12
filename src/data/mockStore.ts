import { Customer, LedgerTransaction } from '../types/customer';

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Rahul Sharma (Electronics)',
    phone: '9876543210',
    address: 'Shop 14, Main Market, Kolkata',
    notes: 'Regular wholesale customer',
    currentBalancePaise: 450000, // ₹4,500.00 you will get
    totalGavePaise: 550000,
    totalGotPaise: 100000,
    lastTransactionDate: '12 Oct 2026',
    createdAt: '2026-09-01T10:00:00Z',
    isArchived: false,
  },
  {
    id: 'cust-2',
    name: 'Anupam Roy (Hardware)',
    phone: '9123456780',
    address: 'Station Road, Howrah',
    notes: 'Credit limit ₹10,000',
    currentBalancePaise: 125000, // ₹1,250 you will get
    totalGavePaise: 125000,
    totalGotPaise: 0,
    lastTransactionDate: '11 Oct 2026',
    createdAt: '2026-09-05T12:00:00Z',
    isArchived: false,
  },
  {
    id: 'cust-3',
    name: 'Bikash Das (Supplier)',
    phone: '9830012345',
    address: 'Burrabazar, Kolkata',
    notes: 'Advance deposit given',
    currentBalancePaise: -85000, // ₹850.00 you will give (payable)
    totalGavePaise: 0,
    totalGotPaise: 85000,
    lastTransactionDate: '10 Oct 2026',
    createdAt: '2026-09-10T14:30:00Z',
    isArchived: false,
  },
  {
    id: 'cust-4',
    name: 'Md. Farhan Akhtar',
    phone: '9748098765',
    address: 'Park Circus, Kolkata',
    notes: 'Monthly billing',
    currentBalancePaise: 0, // ₹0.00 Settled
    totalGavePaise: 0,
    totalGotPaise: 0,
    lastTransactionDate: '08 Oct 2026',
    createdAt: '2026-09-12T09:15:00Z',
    isArchived: false,
  },
  {
    id: 'cust-5',
    name: 'Suman Banerjee',
    phone: '9433123456',
    address: 'Garia Main Road',
    notes: 'Retail customer',
    currentBalancePaise: 275000, // ₹2,750.00 you will get
    totalGavePaise: 275000,
    totalGotPaise: 0,
    lastTransactionDate: '07 Oct 2026',
    createdAt: '2026-09-15T11:45:00Z',
    isArchived: false,
  },
];

export const INITIAL_TRANSACTIONS: Record<string, LedgerTransaction[]> = {
  'cust-1': [
    {
      id: 'tx-101',
      customerId: 'cust-1',
      amountPaise: 200000,
      type: 'GAVE',
      date: '2026-10-01T10:00:00Z',
      description: 'Opening balance / Initial credit',
      isOpeningBalance: true,
      createdAt: '2026-10-01T10:00:00Z',
    },
    {
      id: 'tx-102',
      customerId: 'cust-1',
      amountPaise: 350000,
      type: 'GAVE',
      date: '2026-10-08T15:30:00Z',
      description: 'Invoice #842 - 5x LED panels',
      billNumber: 'INV-842',
      createdAt: '2026-10-08T15:30:00Z',
    },
    {
      id: 'tx-103',
      customerId: 'cust-1',
      amountPaise: 100000,
      type: 'GOT',
      date: '2026-10-12T11:20:00Z',
      description: 'UPI payment received via PhonePe',
      createdAt: '2026-10-12T11:20:00Z',
    },
  ],
  'cust-2': [
    {
      id: 'tx-201',
      customerId: 'cust-2',
      amountPaise: 125000,
      type: 'GAVE',
      date: '2026-10-11T14:00:00Z',
      description: 'Hardware tools udhaar',
      createdAt: '2026-10-11T14:00:00Z',
    },
  ],
  'cust-3': [
    {
      id: 'tx-301',
      customerId: 'cust-3',
      amountPaise: 85000,
      type: 'GOT',
      date: '2026-10-10T09:30:00Z',
      description: 'Advance payment collected from supplier',
      createdAt: '2026-10-10T09:30:00Z',
    },
  ],
};

export function calculateSummaryTotals(customers: Customer[]) {
  let youWillGetPaise = 0;
  let youWillGivePaise = 0;

  for (const c of customers) {
    if (c.currentBalancePaise > 0) {
      youWillGetPaise += c.currentBalancePaise;
    } else if (c.currentBalancePaise < 0) {
      youWillGivePaise += Math.abs(c.currentBalancePaise);
    }
  }

  const netBalancePaise = youWillGetPaise - youWillGivePaise;

  return {
    youWillGetPaise,
    youWillGivePaise,
    netBalancePaise,
  };
}
