import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './firebase/config';
import {
  addCustomer,
  addTransaction,
  deleteCustomerWithTransactions,
  deleteTransaction,
  ensureUserProfile,
  fetchAllUserTransactions,
  subscribeToCustomers,
  subscribeToTransactions,
  syncCustomerTotalsIfNeeded,
  updateCustomer,
  updateTransaction,
} from './services/ledgerService';
import { Customer, LedgerTransaction, TransactionType, UserProfile } from './types/ledger';
import { extractPhoneFromAuthEmail } from './utils/format';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthScreen } from './components/AuthScreen';
import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { CustomersView } from './components/CustomersView';
import { TransactionsFeedView } from './components/TransactionsFeedView';
import { ProfileView } from './components/ProfileView';
import { CustomerDetailView } from './components/CustomerDetailView';
import { AddCustomerModal } from './components/AddCustomerModal';
import { TransactionModal } from './components/TransactionModal';

function BakirKhataApp() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const [allTransactions, setAllTransactions] = useState<LedgerTransaction[]>([]);
  const [loadingAllTx, setLoadingAllTx] = useState(false);

  // Modal states
  const [customerModal, setCustomerModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
  }>({ isOpen: false, mode: 'create' });

  const [txModal, setTxModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    selectedCustomerId: string;
    allowCustomerPicker: boolean;
    initialType: TransactionType;
    editingTx?: LedgerTransaction;
  }>({
    isOpen: false,
    mode: 'create',
    selectedCustomerId: '',
    allowCustomerPicker: false,
    initialType: 'due',
  });

  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  // Listen to Firebase Auth state
  useEffect(() => {
    let active = true;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      setFirebaseUser(user);
      if (user) {
        try {
          const profile = await ensureUserProfile(user);
          if (active) {
            setUserProfile(profile);
          }
        } catch (err) {
          if (active) {
            setRuntimeError(err instanceof Error ? err.message : String(err));
          }
        }
      } else {
        setUserProfile(null);
        setCustomers([]);
        setSelectedCustomerId(null);
        setTransactions([]);
        setAllTransactions([]);
        setActiveTab('home');
      }
      if (active) {
        setAuthReady(true);
      }
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  // Subscribe to current user's customers
  useEffect(() => {
    if (!firebaseUser || !userProfile) {
      setLoadingCustomers(false);
      return;
    }

    setLoadingCustomers(true);
    const unsub = subscribeToCustomers(
      firebaseUser.uid,
      (items) => {
        setCustomers(items);
        setLoadingCustomers(false);
      },
      (err) => {
        setLoadingCustomers(false);
        setRuntimeError(err.message);
      }
    );

    return () => unsub();
  }, [firebaseUser, userProfile]);

  const refreshAllTransactions = useCallback(async () => {
    if (!firebaseUser || customers.length === 0) {
      setAllTransactions([]);
      return;
    }
    setLoadingAllTx(true);
    try {
      const merged = await fetchAllUserTransactions(
        firebaseUser.uid,
        customers.map((c) => c.id)
      );
      setAllTransactions(merged);
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingAllTx(false);
    }
  }, [firebaseUser, customers]);

  // Refresh aggregated transactions when customer totals update
  useEffect(() => {
    refreshAllTransactions();
  }, [refreshAllTransactions]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  // Subscribe to transactions when viewing a specific customer
  useEffect(() => {
    if (!firebaseUser || !selectedCustomerId) {
      setTransactions([]);
      setLoadingTransactions(false);
      return;
    }

    setLoadingTransactions(true);
    const unsub = subscribeToTransactions(
      firebaseUser.uid,
      selectedCustomerId,
      (items) => {
        setTransactions(items);
        setLoadingTransactions(false);
      },
      (err) => {
        setLoadingTransactions(false);
        setRuntimeError(err.message);
      }
    );

    return () => unsub();
  }, [firebaseUser, selectedCustomerId]);

  // Keep customer cached totals reconciled with live transactions
  useEffect(() => {
    if (firebaseUser && selectedCustomer && !loadingTransactions) {
      syncCustomerTotalsIfNeeded(firebaseUser.uid, selectedCustomer, transactions).catch(
        () => {
          // Ignore background sync errors
        }
      );
    }
  }, [firebaseUser, selectedCustomer, transactions, loadingTransactions]);

  if (runtimeError) {
    throw new Error(runtimeError);
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-xl font-bold text-red-600">📒 বাকির খাতা</p>
          <p className="text-sm text-slate-500">লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <AuthScreen />;
  }

  const displayName = userProfile?.name || firebaseUser.displayName || 'ব্যবহারকারী';
  const displayPhone =
    userProfile?.phone || extractPhoneFromAuthEmail(firebaseUser.email) || undefined;

  const modalCustomer =
    customers.find((c) => c.id === txModal.selectedCustomerId) ?? selectedCustomer ?? null;
  const isViewingModalCustomerDetail = Boolean(
    modalCustomer && selectedCustomer && modalCustomer.id === selectedCustomer.id
  );

  const activeTotalDue = modalCustomer
    ? isViewingModalCustomerDetail && !loadingTransactions
      ? transactions.reduce((acc, t) => (t.type === 'due' ? acc + t.amount : acc), 0)
      : modalCustomer.totalDue
    : 0;
  const activeTotalPayment = modalCustomer
    ? isViewingModalCustomerDetail && !loadingTransactions
      ? transactions.reduce((acc, t) => (t.type === 'payment' ? acc + t.amount : acc), 0)
      : modalCustomer.totalPayment
    : 0;

  const handleTabSelect = (tab: NavTab) => {
    setSelectedCustomerId(null);
    setActiveTab(tab);
  };

  const handleQuickActionTransaction = (type: TransactionType, customer?: Customer) => {
    if (customers.length === 0) {
      setCustomerModal({ isOpen: true, mode: 'create' });
      return;
    }
    const target = customer ?? customers[0];
    setTxModal({
      isOpen: true,
      mode: 'create',
      selectedCustomerId: target.id,
      allowCustomerPicker: !customer,
      initialType: type,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header
        userName={displayName}
        onGoHome={() => handleTabSelect('home')}
        onOpenProfile={() => handleTabSelect('profile')}
        onLogout={() => signOut(auth)}
      />

      {selectedCustomer ? (
        <CustomerDetailView
          shopName={displayName}
          shopPhone={displayPhone}
          customer={selectedCustomer}
          transactions={transactions}
          loadingTransactions={loadingTransactions}
          onBack={() => setSelectedCustomerId(null)}
          onEditCustomer={() => setCustomerModal({ isOpen: true, mode: 'edit' })}
          onDeleteCustomer={async () => {
            await deleteCustomerWithTransactions(firebaseUser.uid, selectedCustomer.id);
            setSelectedCustomerId(null);
          }}
          onAddTransaction={(type) =>
            setTxModal({
              isOpen: true,
              mode: 'create',
              selectedCustomerId: selectedCustomer.id,
              allowCustomerPicker: false,
              initialType: type,
            })
          }
          onEditTransaction={(tx) =>
            setTxModal({
              isOpen: true,
              mode: 'edit',
              selectedCustomerId: selectedCustomer.id,
              allowCustomerPicker: false,
              initialType: tx.type,
              editingTx: tx,
            })
          }
          onDeleteTransaction={async (txId) => {
            await deleteTransaction(firebaseUser.uid, selectedCustomer.id, txId);
          }}
        />
      ) : activeTab === 'home' ? (
        <HomeView
          customers={customers}
          allTransactions={allTransactions}
          loading={loadingCustomers}
          loadingAllTx={loadingAllTx}
          onRefreshSummary={refreshAllTransactions}
          onSelectCustomer={(id) => setSelectedCustomerId(id)}
          onGoToCustomersTab={() => setActiveTab('customers')}
          onOpenAddCustomer={() => setCustomerModal({ isOpen: true, mode: 'create' })}
          onQuickActionTransaction={handleQuickActionTransaction}
        />
      ) : activeTab === 'customers' ? (
        <CustomersView
          customers={customers}
          loading={loadingCustomers}
          onSelectCustomer={(id) => setSelectedCustomerId(id)}
          onOpenAddCustomer={() => setCustomerModal({ isOpen: true, mode: 'create' })}
          onQuickTransaction={(customer, type) =>
            handleQuickActionTransaction(type, customer)
          }
        />
      ) : activeTab === 'transactions' ? (
        <TransactionsFeedView
          customers={customers}
          transactions={allTransactions}
          loading={loadingAllTx}
          onRefresh={refreshAllTransactions}
          onSelectCustomer={(id) => setSelectedCustomerId(id)}
        />
      ) : (
        <ProfileView
          userId={firebaseUser.uid}
          userName={displayName}
          userPhone={displayPhone}
          customers={customers}
          totalTransactionsCount={allTransactions.length}
          onProfileNameUpdated={(newName) =>
            setUserProfile((prev) => (prev ? { ...prev, name: newName } : prev))
          }
          onLogout={() => signOut(auth)}
        />
      )}

      <BottomNav activeTab={activeTab} onSelectTab={handleTabSelect} />

      {/* Add / Edit Customer Modal */}
      <AddCustomerModal
        isOpen={customerModal.isOpen}
        mode={customerModal.mode}
        initialName={customerModal.mode === 'edit' ? selectedCustomer?.name ?? '' : ''}
        initialPhone={customerModal.mode === 'edit' ? selectedCustomer?.phone ?? '' : ''}
        onClose={() => setCustomerModal({ isOpen: false, mode: 'create' })}
        onSave={async (data) => {
          if (customerModal.mode === 'edit' && selectedCustomer) {
            await updateCustomer(firebaseUser.uid, selectedCustomer.id, data);
          } else {
            await addCustomer(firebaseUser.uid, data);
          }
        }}
      />

      {/* Add / Edit Transaction Modal */}
      {modalCustomer && (
        <TransactionModal
          isOpen={txModal.isOpen}
          mode={txModal.mode}
          customerName={txModal.allowCustomerPicker ? undefined : modalCustomer.name}
          customers={txModal.allowCustomerPicker ? customers : undefined}
          selectedCustomerId={txModal.selectedCustomerId}
          onSelectCustomerId={(id) =>
            setTxModal((prev) => ({ ...prev, selectedCustomerId: id }))
          }
          initialType={txModal.initialType}
          initialAmount={txModal.editingTx?.amount}
          initialNote={txModal.editingTx?.note}
          initialDate={txModal.editingTx?.transactionDate}
          currentTotalDue={activeTotalDue}
          currentTotalPayment={activeTotalPayment}
          editingOldType={txModal.editingTx?.type}
          editingOldAmount={txModal.editingTx?.amount}
          onClose={() =>
            setTxModal({
              isOpen: false,
              mode: 'create',
              selectedCustomerId: '',
              allowCustomerPicker: false,
              initialType: 'due',
            })
          }
          onSave={async (data) => {
            if (txModal.mode === 'edit' && txModal.editingTx) {
              await updateTransaction(
                firebaseUser.uid,
                data.customerId,
                txModal.editingTx.id,
                data
              );
            } else {
              await addTransaction(firebaseUser.uid, data.customerId, data);
            }
            refreshAllTransactions();
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BakirKhataApp />
    </ErrorBoundary>
  );
}
