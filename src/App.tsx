import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { CustomerList } from './components/CustomerList';
import { CustomerLedger } from './components/CustomerLedger';
import { GeneralLedger } from './components/GeneralLedger';
import { VoiceModal } from './components/VoiceModal';
import { StatementModal } from './components/StatementModal';
import { ManualTransactionModal } from './components/ManualTransactionModal';
import { DashboardData, Person } from './types';
import { fetchDashboard, fetchPeople } from './services/api';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  // Navigation & View state
  const [activeTab, setActiveTab] = useState<'home' | 'customers' | 'ledger'>('home');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  // Data state
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Modal states
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [statementCustomerId, setStatementCustomerId] = useState<number | null>(null);
  const [manualTxModal, setManualTxModal] = useState<{
    isOpen: boolean;
    personId?: number;
    defaultType: 'RECEIVABLE' | 'PAYMENT_RECEIVED';
  }>({
    isOpen: false,
    defaultType: 'RECEIVABLE',
  });

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Monitor online / offline connectivity
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [dashRes, peopleRes] = await Promise.all([fetchDashboard(), fetchPeople()]);
      setDashboardData(dashRes.data);
      setPeople(peopleRes.data);
      setIsOffline(dashRes.isOffline || peopleRes.isOffline);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleSelectCustomer = (personId: number) => {
    setSelectedCustomerId(personId);
    setActiveTab('ledger');
  };

  const handleBackFromLedger = () => {
    setSelectedCustomerId(null);
    setActiveTab('customers');
    loadAllData();
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col font-sans selection:bg-amber-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-4 border border-stone-700 max-w-[90vw] text-center">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <Header
        isOffline={isOffline}
        onOpenVoice={() => setIsVoiceOpen(true)}
        onNavigate={(tab) => {
          setSelectedCustomerId(null);
          setActiveTab(tab);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-md mx-auto">
        {activeTab === 'home' && (
          <Dashboard
            data={dashboardData}
            loading={loading}
            onOpenVoice={() => setIsVoiceOpen(true)}
            onSelectCustomer={handleSelectCustomer}
            onAddCustomer={() => {
              setActiveTab('customers');
            }}
            onNavigateTab={(tab) => {
              setSelectedCustomerId(null);
              setActiveTab(tab);
            }}
          />
        )}

        {activeTab === 'customers' && !selectedCustomerId && (
          <CustomerList
            people={people}
            loading={loading}
            onSelectCustomer={handleSelectCustomer}
            onRefresh={loadAllData}
            onOpenVoice={() => setIsVoiceOpen(true)}
          />
        )}

        {activeTab === 'ledger' && !selectedCustomerId && (
          <GeneralLedger
            onSelectCustomer={handleSelectCustomer}
            onOpenVoice={() => setIsVoiceOpen(true)}
            onSuccess={(msg) => {
              showToast(msg);
              loadAllData();
            }}
          />
        )}

        {selectedCustomerId && (
          <CustomerLedger
            personId={selectedCustomerId}
            onBack={handleBackFromLedger}
            onOpenVoice={() => setIsVoiceOpen(true)}
            onOpenStatement={(pId) => setStatementCustomerId(pId)}
            onOpenManualTransaction={(pId, defaultType) => {
              setManualTxModal({
                isOpen: true,
                personId: pId,
                defaultType,
              });
            }}
            onSuccess={(msg) => {
              showToast(msg);
              loadAllData();
            }}
          />
        )}
      </main>

      {/* Fixed Bottom Mobile Navigation (Visible on Main Screens: Home, Customers, Ledger) */}
      {!selectedCustomerId && (
        <Navigation
          activeTab={activeTab}
          onTabChange={(tab) => {
            setSelectedCustomerId(null);
            setActiveTab(tab);
          }}
          onOpenVoice={() => setIsVoiceOpen(true)}
        />
      )}

      {/* Voice Assistant Modal */}
      <VoiceModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onSuccess={(msg) => {
          showToast(msg);
          loadAllData();
        }}
        onSelectCustomer={handleSelectCustomer}
        onOpenStatement={(pId) => setStatementCustomerId(pId)}
      />

      {/* Statement & PDF Modal */}
      {statementCustomerId && (
        <StatementModal
          personId={statementCustomerId}
          isOpen={!!statementCustomerId}
          onClose={() => setStatementCustomerId(null)}
          onSuccess={(msg) => showToast(msg)}
        />
      )}

      {/* Manual Transaction Modal */}
      <ManualTransactionModal
        isOpen={manualTxModal.isOpen}
        onClose={() => setManualTxModal((prev) => ({ ...prev, isOpen: false }))}
        personId={manualTxModal.personId}
        people={people}
        defaultType={manualTxModal.defaultType}
        onSuccess={(msg) => {
          showToast(msg);
          loadAllData();
        }}
      />
    </div>
  );
}
