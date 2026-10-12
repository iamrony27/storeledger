export type SupportedLanguage = 'en' | 'bn' | 'hi';

export interface Translations {
  common: {
    appName: string;
    search: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    confirm: string;
    loading: string;
    all: string;
    close: string;
    offline: string;
    synced: string;
    syncing: string;
    error: string;
  };
  tabs: {
    customers: string;
    reports: string;
    import: string;
    settings: string;
  };
  dashboard: {
    netBalance: string;
    youWillGet: string;
    youWillGive: string;
    searchPlaceholder: string;
    addCustomer: string;
    filterAll: string;
    filterGet: string;
    filterGive: string;
    filterSettled: string;
    sortByRecent: string;
    sortByAmount: string;
    sortByName: string;
    emptyCustomersTitle: string;
    emptyCustomersDesc: string;
    emptySearchResults: string;
  };
  customerDetail: {
    phone: string;
    address: string;
    call: string;
    whatsapp: string;
    statement: string;
    youGave: string; // Credit given (Udhaar)
    youGot: string;  // Payment received (Jama)
    transactions: string;
    noTransactions: string;
    currentBalance: string;
  };
  addCustomer: {
    title: string;
    nameLabel: string;
    namePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    addressLabel: string;
    addressPlaceholder: string;
    openingBalanceLabel: string;
    balanceTypeLabel: string;
    createButton: string;
  };
  reports: {
    title: string;
    overview: string;
    downloadPdf: string;
    shareStatement: string;
    totalReceivable: string;
    totalPayable: string;
  };
  importer: {
    title: string;
    subtitle: string;
    selectPdf: string;
    previewTitle: string;
    importButton: string;
  };
  settings: {
    title: string;
    language: string;
    theme: string;
    themeSystem: string;
    themeLight: string;
    themeDark: string;
    businessProfile: string;
    backupRestore: string;
    about: string;
  };
}

export const translations: Record<SupportedLanguage, Translations> = {
  en: {
    common: {
      appName: 'GWD book',
      search: 'Search',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      confirm: 'Confirm',
      loading: 'Loading...',
      all: 'All',
      close: 'Close',
      offline: 'Offline',
      synced: 'Synced',
      syncing: 'Syncing...',
      error: 'Error',
    },
    tabs: {
      customers: 'Customers',
      reports: 'Reports',
      import: 'Import',
      settings: 'Settings',
    },
    dashboard: {
      netBalance: 'Net Balance',
      youWillGet: "You'll Get",
      youWillGive: "You'll Give",
      searchPlaceholder: 'Search customer name or phone...',
      addCustomer: 'Add Customer',
      filterAll: 'All',
      filterGet: "You'll Get",
      filterGive: "You'll Give",
      filterSettled: 'Settled',
      sortByRecent: 'Recent',
      sortByAmount: 'Amount',
      sortByName: 'Name',
      emptyCustomersTitle: 'No Customers Added Yet',
      emptyCustomersDesc: 'Start managing your customer ledger by tapping "Add Customer" below.',
      emptySearchResults: 'No customers found matching your search.',
    },
    customerDetail: {
      phone: 'Phone',
      address: 'Address',
      call: 'Call',
      whatsapp: 'WhatsApp',
      statement: 'Report',
      youGave: 'You Gave ₹',
      youGot: 'You Got ₹',
      transactions: 'Transaction History',
      noTransactions: 'No transactions recorded yet.',
      currentBalance: 'Net Balance',
    },
    addCustomer: {
      title: 'Add New Customer',
      nameLabel: 'Customer Name',
      namePlaceholder: 'Enter customer full name',
      phoneLabel: 'Phone Number',
      phonePlaceholder: '10-digit mobile number',
      addressLabel: 'Address (Optional)',
      addressPlaceholder: 'Shop / Street / City',
      openingBalanceLabel: 'Opening Balance (Optional)',
      balanceTypeLabel: 'Balance Type',
      createButton: 'Save Customer',
    },
    reports: {
      title: 'Ledger Reports',
      overview: 'Business Financial Summary',
      downloadPdf: 'Download PDF',
      shareStatement: 'Share Report',
      totalReceivable: 'Total Receivable',
      totalPayable: 'Total Payable',
    },
    importer: {
      title: 'Khatabook PDF Import',
      subtitle: 'Import customer balances directly from Khatabook PDF',
      selectPdf: 'Select Khatabook PDF File',
      previewTitle: 'Extracted Balances Preview',
      importButton: 'Confirm & Import Customers',
    },
    settings: {
      title: 'Settings & Profile',
      language: 'Language / ভাষা / भाषा',
      theme: 'Appearance Theme',
      themeSystem: 'System Default',
      themeLight: 'Light Theme',
      themeDark: 'Dark Theme',
      businessProfile: 'Business Profile',
      backupRestore: 'Data Backup & Restore',
      about: 'About GWD Book',
    },
  },
  bn: {
    common: {
      appName: 'জিডব্লিউডি বুক',
      search: 'অনুসন্ধান',
      save: 'সংরক্ষণ',
      cancel: 'বাতিল',
      delete: 'মুছুন',
      edit: 'সম্পাদনা',
      confirm: 'নিশ্চিত করুন',
      loading: 'লোড হচ্ছে...',
      all: 'সব',
      close: 'বন্ধ করুন',
      offline: 'অফলাইন',
      synced: 'সিঙ্ক হয়েছে',
      syncing: 'সিঙ্ক হচ্ছে...',
      error: 'ত্রুটি',
    },
    tabs: {
      customers: 'গ্রাহক তালিকা',
      reports: 'রিপোর্ট',
      import: 'ইম্পোর্ট',
      settings: 'সেটিংস',
    },
    dashboard: {
      netBalance: 'মোট ব্যালেন্স',
      youWillGet: 'আপনি পাবেন',
      youWillGive: 'আপনি দেবেন',
      searchPlaceholder: 'নাম বা মোবাইল নম্বর দিয়ে খুঁজুন...',
      addCustomer: 'নতুন গ্রাহক যোগ করুন',
      filterAll: 'সব',
      filterGet: 'পাবেন',
      filterGive: 'দেবেন',
      filterSettled: 'পরিশোধিত',
      sortByRecent: 'সাম্প্রতিক',
      sortByAmount: 'টাকার পরিমাণ',
      sortByName: 'নাম অনুসারে',
      emptyCustomersTitle: 'এখনও কোনো গ্রাহক যোগ করা হয়নি',
      emptyCustomersDesc: 'নিচের "নতুন গ্রাহক যোগ করুন" বাটনে ট্যাপ করে শুরু করুন।',
      emptySearchResults: 'এই অনুসন্ধানে কোনো গ্রাহক পাওয়া যায়নি।',
    },
    customerDetail: {
      phone: 'ফোন',
      address: 'ঠিকানা',
      call: 'কল করুন',
      whatsapp: 'হোয়াটসঅ্যাপ',
      statement: 'রিপোর্ট',
      youGave: 'আপনি দিয়েছেন ₹',
      youGot: 'আপনি পেয়েছেন ₹',
      transactions: 'লেনদেনের বিবরণ',
      noTransactions: 'এখনও কোনো লেনদেন লিপিবদ্ধ করা হয়নি।',
      currentBalance: 'বর্তমান ব্যালেন্স',
    },
    addCustomer: {
      title: 'নতুন গ্রাহক যোগ',
      nameLabel: 'গ্রাহকের নাম',
      namePlaceholder: 'গ্রাহকের পুরো নাম লিখুন',
      phoneLabel: 'মোবাইল নম্বর',
      phonePlaceholder: '১০ সংখ্যার মোবাইল নম্বর',
      addressLabel: 'ঠিকানা (ঐচ্ছিক)',
      addressPlaceholder: 'দোকান / এলাকা / শহর',
      openingBalanceLabel: 'পূর্বের বকেয়া (ঐচ্ছিক)',
      balanceTypeLabel: 'বকেয়ার ধরন',
      createButton: 'গ্রাহক সংরক্ষণ করুন',
    },
    reports: {
      title: 'হিসাব বিবরণী রিপোর্ট',
      overview: 'ব্যবসার আর্থিক সারসংক্ষেপ',
      downloadPdf: 'পিডিএফ ডাউনলোড',
      shareStatement: 'রিপোর্ট শেয়ার করুন',
      totalReceivable: 'মোট পাওনা',
      totalPayable: 'মোট দেনা',
    },
    importer: {
      title: 'খাতাবুক PDF ইম্পোর্ট',
      subtitle: 'খাতাবুক রিপোর্ট থেকে সরাসরি গ্রাহক ব্যালেন্স আনুন',
      selectPdf: 'খাতাবুক PDF ফাইল নির্বাচন করুন',
      previewTitle: 'এক্সট্র্যাক্ট করা ব্যালেন্স প্রিভিউ',
      importButton: 'নিশ্চিত করুন এবং ইম্পোর্ট করুন',
    },
    settings: {
      title: 'সেটিংস ও প্রোফাইল',
      language: 'ভাষা পরিবর্তন (Language)',
      theme: 'থিম পরিবর্তন',
      themeSystem: 'সিস্টেম ডিফল্ট',
      themeLight: 'লাইট মোড',
      themeDark: 'ডার্ক মোড',
      businessProfile: 'ব্যবসার প্রোফাইল',
      backupRestore: 'ডাটা ব্যাকআপ ও রিস্টোর',
      about: 'জিডব্লিউডি বুক পরিচিতি',
    },
  },
  hi: {
    common: {
      appName: 'जीडब्ल्यूडी बुक',
      search: 'खोजें',
      save: 'सुरक्षित करें',
      cancel: 'रद्द करें',
      delete: 'हटाएं',
      edit: 'बदलें',
      confirm: 'पुष्टि करें',
      loading: 'लोड हो रहा है...',
      all: 'सभी',
      close: 'बंद करें',
      offline: 'ऑफ़लाइन',
      synced: 'सिंक हो गया',
      syncing: 'सिंक हो रहा है...',
      error: 'त्रुटि',
    },
    tabs: {
      customers: 'ग्राहक सूची',
      reports: 'रिपोर्ट',
      import: 'इंपोर्ट',
      settings: 'सेटिंग्स',
    },
    dashboard: {
      netBalance: 'कुल बैलेंस',
      youWillGet: 'आपको मिलेगा',
      youWillGive: 'आपको देना है',
      searchPlaceholder: 'ग्राहक का नाम या फोन नंबर खोजें...',
      addCustomer: 'नया ग्राहक जोड़ें',
      filterAll: 'सभी',
      filterGet: 'मिलेगा',
      filterGive: 'देना है',
      filterSettled: 'हिसाब चुकता',
      sortByRecent: 'हाल के',
      sortByAmount: 'रकम अनुसार',
      sortByName: 'नाम अनुसार',
      emptyCustomersTitle: 'अभी तक कोई ग्राहक नहीं जोड़ा गया',
      emptyCustomersDesc: 'नीचे "नया ग्राहक जोड़ें" बटन दबाकर शुरू करें।',
      emptySearchResults: 'खोज के अनुसार कोई ग्राहक नहीं मिला।',
    },
    customerDetail: {
      phone: 'फ़ोन',
      address: 'पता',
      call: 'कॉल करें',
      whatsapp: 'व्हाट्सएप',
      statement: 'रिपोर्ट',
      youGave: 'आपने दिए ₹',
      youGot: 'आपको मिले ₹',
      transactions: 'लेन-देन इतिहास',
      noTransactions: 'अभी तक कोई लेन-देन दर्ज नहीं है।',
      currentBalance: 'वर्तमान बैलेंस',
    },
    addCustomer: {
      title: 'नया ग्राहक जोड़ें',
      nameLabel: 'ग्राहक का नाम',
      namePlaceholder: 'ग्राहक का पूरा नाम दर्ज करें',
      phoneLabel: 'मोबाइल नंबर',
      phonePlaceholder: '10 अंकों का मोबाइल नंबर',
      addressLabel: 'पता (वैकल्पिक)',
      addressPlaceholder: 'दुकान / गली / शहर',
      openingBalanceLabel: 'प्रारंभिक बैलेंस (वैकल्पिक)',
      balanceTypeLabel: 'बैलेंस प्रकार',
      createButton: 'ग्राहक सुरक्षित करें',
    },
    reports: {
      title: 'खाता रिपोर्ट',
      overview: 'व्यापार वित्तीय सारांश',
      downloadPdf: 'पीडीएफ डाउनलोड करें',
      shareStatement: 'रिपोर्ट साझा करें',
      totalReceivable: 'कुल लेना है',
      totalPayable: 'कुल देना है',
    },
    importer: {
      title: 'खाताबुक PDF इंपोर्ट',
      subtitle: 'खाताबुक रिपोर्ट से सीधे ग्राहक बैलेंस लाएं',
      selectPdf: 'खाताबुक PDF फ़ाइल चुनें',
      previewTitle: 'निकाला गया बैलेंस पूर्वावलोकन',
      importButton: 'पुष्टि करें और इंपोर्ट करें',
    },
    settings: {
      title: 'सेटिंग्स और प्रोफ़ाइल',
      language: 'भाषा बदलें (Language)',
      theme: 'दिखावट थीम',
      themeSystem: 'सिस्टम डिफ़ॉल्ट',
      themeLight: 'लाइट थीम',
      themeDark: 'डार्क थीम',
      businessProfile: 'व्यापार प्रोफ़ाइल',
      backupRestore: 'डेटा बैकअप और पुनर्स्थापना',
      about: 'जीडब्ल्यूडी बुक के बारे में',
    },
  },
};
