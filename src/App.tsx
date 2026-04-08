/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  orderBy,
  getDocFromServer,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import { Bike, ServiceLog, MileageLog, Reminder, FuelLog } from './types';
import { 
  Bike as BikeIcon, 
  Plus, 
  Wrench, 
  Droplets, 
  Calendar, 
  LogOut, 
  History, 
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit2,
  ChevronRight,
  Gauge,
  Camera,
  Loader2,
  Image as ImageIcon,
  X,
  Check,
  Fuel,
  Download,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInDays, parseISO, addDays, startOfDay } from 'date-fns';
import { cn } from './lib/utils';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In a real app, we might show a toast here
}

// --- Components ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [selectedBike, setSelectedBike] = useState<Bike | null>(null);
  const [serviceLogs, setServiceLogs] = useState<ServiceLog[]>([]);
  const [mileageLogs, setMileageLogs] = useState<MileageLog[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showBikeForm, setShowBikeForm] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);
  const [showMileageForm, setShowMileageForm] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [showFuelForm, setShowFuelForm] = useState(false);
  const [showEditBike, setShowEditBike] = useState<Bike | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCompletedReminders, setShowCompletedReminders] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'service' | 'fuel'>('service');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Connection Test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Data Fetching
  useEffect(() => {
    if (!user) {
      setBikes([]);
      return;
    }

    const bikesQuery = query(
      collection(db, 'bikes'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(bikesQuery, (snapshot) => {
      const bikesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Bike[];
      setBikes(bikesData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'bikes'));

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!selectedBike) {
      setServiceLogs([]);
      return;
    }

    const logsQuery = query(
      collection(db, 'serviceLogs'),
      where('bikeId', '==', selectedBike.id),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ServiceLog[];
      setServiceLogs(logsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `serviceLogs/${selectedBike.id}`));

    return () => unsubscribe();
  }, [selectedBike]);

  useEffect(() => {
    if (!selectedBike || !user) {
      setReminders([]);
      return;
    }

    const remindersQuery = query(
      collection(db, 'reminders'),
      where('bikeId', '==', selectedBike.id),
      where('userId', '==', user.uid),
      orderBy('date', 'asc')
    );

    const unsubscribe = onSnapshot(remindersQuery, (snapshot) => {
      const remindersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reminder[];
      setReminders(remindersData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `reminders/${selectedBike.id}`));

    return () => unsubscribe();
  }, [selectedBike, user]);

  useEffect(() => {
    if (!selectedBike || !user) {
      setMileageLogs([]);
      return;
    }

    const mileageQuery = query(
      collection(db, 'mileageLogs'),
      where('bikeId', '==', selectedBike.id),
      where('userId', '==', user.uid),
      orderBy('date', 'asc')
    );

    const unsubscribe = onSnapshot(mileageQuery, (snapshot) => {
      const mileageData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MileageLog[];
      setMileageLogs(mileageData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `mileageLogs/${selectedBike.id}`));

    return () => unsubscribe();
  }, [selectedBike, user]);

  useEffect(() => {
    if (!selectedBike || !user) {
      setFuelLogs([]);
      return;
    }

    const fuelQuery = query(
      collection(db, 'fuelLogs'),
      where('bikeId', '==', selectedBike.id),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(fuelQuery, (snapshot) => {
      const fuelData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FuelLog[];
      setFuelLogs(fuelData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `fuelLogs/${selectedBike.id}`));

    return () => unsubscribe();
  }, [selectedBike, user]);

  const filteredBikes = bikes.filter(bike => 
    bike.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bike.model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBike || !user) return;

    try {
      const storageRef = ref(storage, `bikes/${user.uid}/${selectedBike.id}/gallery/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const updatedGallery = [...(selectedBike.gallery || []), downloadURL];
      await updateDoc(doc(db, 'bikes', selectedBike.id), {
        gallery: updatedGallery
      });
      
      // Update local state for immediate feedback
      setSelectedBike({ ...selectedBike, gallery: updatedGallery });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bikes/${selectedBike.id}/gallery`);
    }
  };

  const removeGalleryImage = async (imageUrl: string) => {
    if (!selectedBike) return;
    try {
      const updatedGallery = (selectedBike.gallery || []).filter(url => url !== imageUrl);
      await updateDoc(doc(db, 'bikes', selectedBike.id), {
        gallery: updatedGallery
      });
      setSelectedBike({ ...selectedBike, gallery: updatedGallery });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bikes/${selectedBike.id}/gallery`);
    }
  };

  const toggleReminder = async (reminder: Reminder) => {
    try {
      await updateDoc(doc(db, 'reminders', reminder.id), {
        isCompleted: !reminder.isCompleted
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reminders/${reminder.id}`);
    }
  };

  const deleteReminder = async (reminderId: string) => {
    try {
      await deleteDoc(doc(db, 'reminders', reminderId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reminders/${reminderId}`);
    }
  };

  const exportToCSV = () => {
    if (!selectedBike) return;

    const headers = ['Type', 'Date', 'Description/Mileage', 'Cost', 'Quantity/Details'];
    const rows: string[][] = [];

    // Add Service Logs
    serviceLogs.forEach(log => {
      rows.push([
        'Service',
        log.date,
        log.description,
        log.cost?.toString() || '0',
        `${log.mileage} KM`
      ]);
    });

    // Add Fuel Logs
    fuelLogs.forEach(log => {
      rows.push([
        'Fuel',
        log.date,
        `Refuel at ${log.mileage} KM`,
        log.cost.toString(),
        `${log.quantity} L`
      ]);
    });

    // Add Mileage Logs
    mileageLogs.forEach(log => {
      rows.push([
        'Mileage',
        log.date,
        'Ride Log',
        '0',
        `${log.mileage} KM`
      ]);
    });

    // Sort by date
    rows.sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime());

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedBike.brand}_${selectedBike.model}_data_export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0">
          <motion.div 
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.7 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <img 
              src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2070" 
              className="w-full h-full object-cover brightness-110"
              alt="Nature Background"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/10 via-zinc-950/40 to-zinc-950" />
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8 relative z-10"
        >
          <div className="flex justify-center">
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 100 }}
              className="relative group"
            >
              <div className="absolute -inset-4 bg-orange-500/20 rounded-full blur-2xl group-hover:bg-orange-500/30 transition-all" />
              <div className="relative bg-zinc-900/50 backdrop-blur-xl p-1 rounded-3xl border border-white/10 overflow-hidden shadow-2xl w-64 h-64 mx-auto">
                <img 
                  src="https://images.unsplash.com/photo-1622185135505-2d795003994a?auto=format&fit=crop&q=80&w=1000" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                  alt="Royal Enfield Himalayan"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-black text-white tracking-tighter italic">MOTOLOG</h1>
            <p className="text-zinc-400 font-medium">Adventure awaits. Track your journey and keep your machine in peak condition.</p>
          </div>
          <button
            onClick={handleLogin}
            className="w-full bg-white text-black hover:bg-zinc-200 font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Start Your Journey
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans relative">
      {/* Background Nature Element */}
      <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
        <img 
          src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=2071" 
          className="w-full h-full object-cover brightness-110"
          alt="Nature Background"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-zinc-950/60" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 p-2 rounded-xl">
              <BikeIcon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">MotoLog</h1>
          </div>
          <div className="flex items-center gap-4">
            <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-zinc-700" alt="Profile" />
            <button onClick={handleLogout} className="text-zinc-400 hover:text-white transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
        {/* Bike Selection */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-zinc-400 uppercase tracking-widest text-xs">My Garage</h2>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                  type="text"
                  placeholder="Search brand or model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                />
              </div>
              <button 
                onClick={() => setShowBikeForm(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBikes.map(bike => (
              <motion.div
                key={bike.id}
                layoutId={bike.id}
                onClick={() => setSelectedBike(bike)}
                className={cn(
                  "relative group cursor-pointer rounded-3xl border transition-all duration-300 overflow-hidden",
                  selectedBike?.id === bike.id 
                    ? "bg-orange-500/10 border-orange-500/50 ring-1 ring-orange-500/50" 
                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                )}
              >
                {/* Bike Image Header */}
                <div className="aspect-video w-full relative bg-zinc-800 overflow-hidden">
                  {bike.imageUrl ? (
                    <img 
                      src={bike.imageUrl} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                      alt={bike.model}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                      <BikeIcon className="w-16 h-16" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/20 to-transparent" />
                  
                  {/* Action Buttons */}
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowEditBike(bike);
                      }}
                      className="p-2 bg-black/50 hover:bg-zinc-700 text-white rounded-xl backdrop-blur-md transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(bike.id);
                      }}
                      className="p-2 bg-black/50 hover:bg-red-500 text-white rounded-xl backdrop-blur-md transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-6 relative -mt-8">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">{bike.brand}</h3>
                      <p className="text-zinc-400">{bike.model} {bike.year && `(${bike.year})`}</p>
                    </div>
                    <div className={cn(
                      "p-3 rounded-2xl shadow-lg",
                      selectedBike?.id === bike.id ? "bg-orange-500 text-white" : "bg-zinc-800 text-zinc-400"
                    )}>
                      <BikeIcon className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300 font-mono text-sm">
                    <Gauge className="w-4 h-4 text-orange-500" />
                    {bike.currentMileage.toLocaleString()} KM
                  </div>
                </div>
              </motion.div>
            ))}
            {filteredBikes.length === 0 && (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-800 rounded-3xl">
                <p className="text-zinc-500">
                  {searchQuery ? "No bikes match your search." : "No bikes in your garage yet. Add your first one!"}
                </p>
              </div>
            )}
          </div>
        </section>

        {selectedBike && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Hero Cover Image */}
            <div className="relative h-64 md:h-[400px] w-full rounded-[2.5rem] overflow-hidden border border-zinc-800 shadow-2xl group">
              {selectedBike.imageUrl ? (
                <img 
                  src={selectedBike.imageUrl} 
                  className="w-full h-full object-cover" 
                  alt={selectedBike.model}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-800">
                  <BikeIcon className="w-24 h-24" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
              
              <div className="absolute bottom-8 left-8 right-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    {selectedBike.year && (
                      <span className="px-3 py-1 bg-orange-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg shadow-orange-500/20">
                        {selectedBike.year}
                      </span>
                    )}
                    <span className="text-zinc-400 text-sm font-bold uppercase tracking-[0.2em]">{selectedBike.brand}</span>
                  </div>
                  <h2 className="text-4xl md:text-7xl font-black text-white tracking-tighter italic uppercase leading-none">
                    {selectedBike.model}
                  </h2>
                </div>
                
                <div className="flex items-center gap-8 bg-black/40 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/10 shadow-2xl">
                  <div className="text-center">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Odometer</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white font-mono tracking-tighter">{selectedBike.currentMileage.toLocaleString()}</span>
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">KM</span>
                    </div>
                  </div>
                  <div className="w-px h-10 bg-zinc-800" />
                  <div className="text-center">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm font-bold text-white uppercase tracking-widest">Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Reminders & Stats */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 space-y-6">
                <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-widest">Maintenance Status</h3>
                
                {/* Chain Lube Reminder */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium">Chain Lube</span>
                    </div>
                    <span className="text-xs text-zinc-500">Every 500km</span>
                  </div>
                  {(() => {
                    const diff = selectedBike.currentMileage - (selectedBike.lastChainLubeMileage || 0);
                    const progress = Math.min((diff / 500) * 100, 100);
                    const isDue = diff >= 500;
                    return (
                      <div className="space-y-2">
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full transition-all duration-500", isDue ? "bg-red-500" : "bg-blue-500")}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className={cn("text-xs font-medium", isDue ? "text-red-400" : "text-zinc-400")}>
                            {isDue ? "Due Now!" : `${500 - diff}km remaining`}
                          </span>
                          {isDue && <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Wash Reminder */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm font-medium">Bike Wash</span>
                    </div>
                    <span className="text-xs text-zinc-500">Every 21 days</span>
                  </div>
                  {(() => {
                    const lastWash = selectedBike.lastWashDate ? parseISO(selectedBike.lastWashDate) : null;
                    const daysSince = lastWash ? differenceInDays(new Date(), lastWash) : 999;
                    const progress = Math.min((daysSince / 21) * 100, 100);
                    const isDue = daysSince >= 21;
                    return (
                      <div className="space-y-2">
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full transition-all duration-500", isDue ? "bg-red-500" : "bg-cyan-500")}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className={cn("text-xs font-medium", isDue ? "text-red-400" : "text-zinc-400")}>
                            {isDue ? "Due Now!" : `${21 - daysSince} days remaining`}
                          </span>
                          {isDue && <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Custom Reminders */}
                <div className="pt-4 border-t border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Custom Reminders</h4>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setShowCompletedReminders(!showCompletedReminders)}
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg transition-all",
                          showCompletedReminders ? "bg-zinc-800 text-zinc-300" : "text-zinc-500 hover:text-zinc-400"
                        )}
                      >
                        {showCompletedReminders ? "Show Active" : "Show Done"}
                      </button>
                      <button 
                        onClick={() => setShowReminderForm(true)}
                        className="text-orange-500 hover:text-orange-400 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {reminders
                      .filter(r => showCompletedReminders ? r.isCompleted : !r.isCompleted)
                      .map(reminder => (
                      <div key={reminder.id} className="group flex items-center justify-between bg-zinc-800/50 p-3 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <button 
                            onClick={() => toggleReminder(reminder)}
                            className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                              reminder.isCompleted 
                                ? "bg-green-500 border-green-500 text-white" 
                                : "border-zinc-700 hover:border-orange-500"
                            )}
                          >
                            {reminder.isCompleted && <Check className="w-3 h-3" />}
                          </button>
                          <div className="min-w-0">
                            <p className={cn(
                              "text-sm font-medium truncate",
                              reminder.isCompleted ? "text-zinc-500 line-through" : "text-white"
                            )}>
                              {reminder.title}
                            </p>
                            <p className="text-[10px] text-zinc-500 font-mono">
                              {format(parseISO(reminder.date), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteReminder(reminder.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {reminders.filter(r => showCompletedReminders ? r.isCompleted : !r.isCompleted).length === 0 && (
                      <p className="text-[10px] text-zinc-600 italic text-center py-2">
                        {showCompletedReminders ? "No completed reminders" : "No active reminders"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800 flex flex-wrap gap-2">
                  <button 
                    onClick={() => setShowMileageForm(true)}
                    className="flex-1 min-w-[120px] bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-3 rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    <TrendingUp className="w-4 h-4" /> Log Ride
                  </button>
                  <button 
                    onClick={() => setShowLogForm(true)}
                    className="flex-1 min-w-[120px] bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold py-3 rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    <Wrench className="w-4 h-4" /> Service
                  </button>
                  <button 
                    onClick={() => setShowFuelForm(true)}
                    className="flex-1 min-w-[120px] bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold py-3 rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    <Fuel className="w-4 h-4" /> Fuel
                  </button>
                </div>
              </div>

              {/* Gallery Section */}
              <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-widest">Gallery</h3>
                  <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-2 rounded-xl transition-colors">
                    <Plus className="w-4 h-4" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleGalleryUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {selectedBike.gallery?.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden group bg-zinc-800">
                      <img 
                        src={url} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                        alt={`Gallery ${idx}`}
                        referrerPolicy="no-referrer"
                      />
                      <button 
                        onClick={() => removeGalleryImage(url)}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {(!selectedBike.gallery || selectedBike.gallery.length === 0) && (
                    <div className="col-span-2 py-8 text-center border border-dashed border-zinc-800 rounded-2xl">
                      <ImageIcon className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                      <p className="text-xs text-zinc-600">No photos yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* History */}
            <div className="lg:col-span-2 space-y-6">
              {/* Mileage Trend Chart */}
              <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-widest">Mileage Trend</h3>
                  <TrendingUp className="w-4 h-4 text-zinc-500" />
                </div>
                <div className="h-64 w-full">
                  {mileageLogs.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mileageLogs.map(log => ({
                        date: format(parseISO(log.date), 'MMM d'),
                        mileage: log.mileage
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#71717a" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <YAxis 
                          stroke="#71717a" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                          tickFormatter={(value) => `${value}k`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#18181b', 
                            border: '1px solid #27272a',
                            borderRadius: '12px',
                            fontSize: '12px'
                          }}
                          itemStyle={{ color: '#f97316' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="mileage" 
                          stroke="#f97316" 
                          strokeWidth={3} 
                          dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 gap-2 border border-dashed border-zinc-800 rounded-2xl">
                      <TrendingUp className="w-8 h-8 opacity-20" />
                      <p className="text-xs">Log more rides to see your trend</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center justify-between">
                <div className="flex p-1 bg-zinc-900 rounded-2xl border border-zinc-800 w-fit">
                  <button 
                    onClick={() => setActiveTab('service')}
                    className={cn(
                      "px-6 py-2 rounded-xl text-sm font-semibold transition-all",
                      activeTab === 'service' ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-400"
                    )}
                  >
                    Service History
                  </button>
                  <button 
                    onClick={() => setActiveTab('fuel')}
                    className={cn(
                      "px-6 py-2 rounded-xl text-sm font-semibold transition-all",
                      activeTab === 'fuel' ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-400"
                    )}
                  >
                    Fuel Logs
                  </button>
                </div>

                <button 
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-zinc-700"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>

              {activeTab === 'service' ? (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-widest">Service History</h3>
                    <History className="w-4 h-4 text-zinc-500" />
                  </div>

              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-zinc-900/50 p-4 rounded-3xl border border-zinc-800">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Type</label>
                  <select 
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                  >
                    <option value="all">All Types</option>
                    <option value="service">Service</option>
                    <option value="repair">Repair</option>
                    <option value="chain-lube">Chain Lube</option>
                    <option value="wash">Wash</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">From</label>
                  <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">To</label>
                  <input 
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                {serviceLogs
                  .filter(log => {
                    const matchesType = filterType === 'all' || log.type === filterType;
                    const logDate = parseISO(log.date);
                    const matchesStart = !startDate || logDate >= parseISO(startDate);
                    const matchesEnd = !endDate || logDate <= parseISO(endDate);
                    return matchesType && matchesStart && matchesEnd;
                  })
                  .map(log => (
                  <div key={log.id} className="bg-zinc-900 p-5 rounded-3xl border border-zinc-800 flex items-start gap-4">
                    <div className={cn(
                      "p-3 rounded-2xl shrink-0",
                      log.type === 'service' ? "bg-orange-500/10 text-orange-500" :
                      log.type === 'chain-lube' ? "bg-blue-500/10 text-blue-500" :
                      log.type === 'wash' ? "bg-cyan-500/10 text-cyan-500" : "bg-zinc-800 text-zinc-400"
                    )}>
                      {log.type === 'service' ? <Wrench className="w-5 h-5" /> :
                       log.type === 'chain-lube' ? <Droplets className="w-5 h-5" /> :
                       log.type === 'wash' ? <Droplets className="w-5 h-5" /> : <History className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-white truncate">{log.description}</h4>
                        <span className="text-xs text-zinc-500 font-mono">{format(parseISO(log.date), 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1 text-xs text-zinc-400">
                          <Gauge className="w-3 h-3" />
                          {log.mileage.toLocaleString()} KM
                        </div>
                        {log.cost && (
                          <div className="text-xs text-green-500 font-medium">
                            ₹{log.cost.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                    {log.imageUrl && (
                      <div 
                        onClick={() => setSelectedImage(log.imageUrl!)}
                        className="w-16 h-16 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-orange-500 transition-all border border-zinc-800 shrink-0"
                      >
                        <img src={log.imageUrl} className="w-full h-full object-cover" alt="Log" />
                      </div>
                    )}
                  </div>
                ))}
                {serviceLogs.length === 0 && (
                  <div className="py-12 text-center bg-zinc-900/50 border border-zinc-800 border-dashed rounded-3xl">
                    <p className="text-zinc-500">No service logs yet.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-widest">Fuel Logs</h3>
                <Fuel className="w-4 h-4 text-zinc-500" />
              </div>

              <div className="space-y-4">
                {fuelLogs.map(log => (
                  <div key={log.id} className="bg-zinc-900 p-5 rounded-3xl border border-zinc-800 flex items-start gap-4">
                    <div className="p-3 rounded-2xl shrink-0 bg-green-500/10 text-green-500">
                      <Fuel className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-white truncate">Refuel at {log.mileage.toLocaleString()} KM</h4>
                        <span className="text-xs text-zinc-500 font-mono">{format(parseISO(log.date), 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-6 mt-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold">Cost</span>
                          <span className="text-sm text-green-500 font-medium">₹{log.cost.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold">Quantity</span>
                          <span className="text-sm text-zinc-300 font-medium">{log.quantity} L</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold">Price/L</span>
                          <span className="text-sm text-zinc-400">₹{(log.cost / log.quantity).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    {log.imageUrl && (
                      <div 
                        onClick={() => setSelectedImage(log.imageUrl!)}
                        className="w-16 h-16 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-orange-500 transition-all border border-zinc-800 shrink-0"
                      >
                        <img src={log.imageUrl} className="w-full h-full object-cover" alt="Fuel Log" />
                      </div>
                    )}
                  </div>
                ))}
                {fuelLogs.length === 0 && (
                  <div className="py-12 text-center bg-zinc-900/50 border border-zinc-800 border-dashed rounded-3xl">
                    <p className="text-zinc-500">No fuel logs yet.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )}
</main>

      {/* Modals */}
      <AnimatePresence>
        {showBikeForm && (
          <BikeForm 
            userId={user.uid} 
            onClose={() => setShowBikeForm(false)} 
          />
        )}
        {showLogForm && selectedBike && (
          <LogForm 
            bike={selectedBike} 
            onClose={() => setShowLogForm(false)} 
          />
        )}
        {showMileageForm && selectedBike && (
          <MileageForm 
            bike={selectedBike} 
            onClose={() => setShowMileageForm(false)} 
          />
        )}
        {showReminderForm && selectedBike && (
          <ReminderForm 
            bike={selectedBike} 
            onClose={() => setShowReminderForm(false)} 
          />
        )}
        {showFuelForm && selectedBike && (
          <FuelLogForm 
            bike={selectedBike} 
            onClose={() => setShowFuelForm(false)} 
          />
        )}
        {showEditBike && (
          <BikeForm 
            userId={user.uid} 
            bike={showEditBike}
            onClose={() => setShowEditBike(null)} 
          />
        )}
        {selectedImage && (
          <ImageModal 
            imageUrl={selectedImage} 
            onClose={() => setSelectedImage(null)} 
          />
        )}
        {showDeleteConfirm && (
          <DeleteConfirmModal 
            bikeId={showDeleteConfirm} 
            bikeName={bikes.find(b => b.id === showDeleteConfirm)?.model || 'this bike'}
            onClose={() => setShowDeleteConfirm(null)} 
            onDeleted={() => {
              if (selectedBike?.id === showDeleteConfirm) setSelectedBike(null);
              setShowDeleteConfirm(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function BikeForm({ userId, bike, onClose }: { userId: string, bike?: Bike, onClose: () => void }) {
  const [brand, setBrand] = useState(bike?.brand || '');
  const [model, setModel] = useState(bike?.model || '');
  const [year, setYear] = useState(bike?.year?.toString() || '');
  const [mileage, setMileage] = useState(bike?.currentMileage.toString() || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(bike?.imageUrl || null);
  const [uploading, setUploading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      let imageUrl = bike?.imageUrl || '';
      if (imageFile) {
        const storageRef = ref(storage, `bikes/${userId}/${Date.now()}_${imageFile.name}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      const bikeData = {
        userId,
        brand,
        model,
        year: parseInt(year) || null,
        currentMileage: parseInt(mileage) || 0,
        imageUrl,
      };

      if (bike) {
        await updateDoc(doc(db, 'bikes', bike.id), bikeData);
      } else {
        await addDoc(collection(db, 'bikes'), {
          ...bikeData,
          lastChainLubeMileage: parseInt(mileage) || 0,
          lastWashDate: new Date().toISOString(),
          lastServiceDate: new Date().toISOString(),
          lastServiceMileage: parseInt(mileage) || 0,
          gallery: []
        });
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, bike ? OperationType.UPDATE : OperationType.CREATE, 'bikes');
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-xl font-bold">{bike ? 'Edit Bike' : 'Add New Bike'}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Image Upload */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Bike Cover Photo</label>
            <div 
              onClick={() => document.getElementById('bike-image')?.click()}
              className="relative aspect-video bg-zinc-800 border-2 border-dashed border-zinc-700 rounded-3xl overflow-hidden cursor-pointer hover:border-orange-500/50 transition-all group shadow-inner"
            >
              {imagePreview ? (
                <>
                  <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-full border border-white/20">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-3">
                  <div className="p-4 bg-zinc-900 rounded-full border border-zinc-800 group-hover:border-orange-500/50 transition-colors">
                    <Camera className="w-8 h-8 group-hover:text-orange-500 transition-colors" />
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-bold uppercase tracking-widest block">Upload Photo</span>
                    <span className="text-[10px] text-zinc-700 uppercase tracking-widest">JPG, PNG up to 5MB</span>
                  </div>
                </div>
              )}
              <input 
                id="bike-image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Brand</label>
            <input 
              required
              value={brand}
              onChange={e => setBrand(e.target.value)}
              placeholder="e.g. Royal Enfield"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Model</label>
            <input 
              required
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="e.g. Classic 350"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Year</label>
              <input 
                type="number"
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder="2023"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Current KM</label>
              <input 
                required
                type="number"
                value={mileage}
                onChange={e => setMileage(e.target.value)}
                placeholder="0"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              />
            </div>
          </div>
          <button 
            type="submit"
            disabled={uploading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white font-semibold py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/20 mt-4 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading...
              </>
            ) : (
              bike ? 'Save Bike' : 'Add to Garage'
            )}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

function LogForm({ bike, onClose }: { bike: Bike, onClose: () => void }) {
  const [type, setType] = useState<ServiceLog['type']>('service');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [mileage, setMileage] = useState(bike.currentMileage.toString());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      let imageUrl = '';
      if (imageFile) {
        const storageRef = ref(storage, `logs/${bike.userId}/${Date.now()}_${imageFile.name}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      const logData = {
        bikeId: bike.id,
        userId: bike.userId,
        date: new Date().toISOString(),
        mileage: parseInt(mileage),
        description,
        cost: parseFloat(cost) || null,
        type,
        imageUrl
      };

      await addDoc(collection(db, 'serviceLogs'), logData);

      // Update bike status
      const updates: Partial<Bike> = {
        currentMileage: Math.max(bike.currentMileage, parseInt(mileage))
      };

      if (type === 'chain-lube') {
        updates.lastChainLubeMileage = parseInt(mileage);
      } else if (type === 'wash') {
        updates.lastWashDate = new Date().toISOString();
      } else if (type === 'service') {
        updates.lastServiceDate = new Date().toISOString();
        updates.lastServiceMileage = parseInt(mileage);
      }

      await updateDoc(doc(db, 'bikes', bike.id), updates);
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'serviceLogs');
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-xl font-bold">Log Maintenance</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Image Upload */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Log Photo (Receipt/Work)</label>
            <div 
              onClick={() => document.getElementById('log-image')?.click()}
              className="relative aspect-video bg-zinc-800 border-2 border-dashed border-zinc-700 rounded-2xl overflow-hidden cursor-pointer hover:border-orange-500/50 transition-all group"
            >
              {imagePreview ? (
                <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
                  <Camera className="w-8 h-8" />
                  <span className="text-xs font-bold uppercase tracking-widest">Upload Photo</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-8 h-8 text-white" />
              </div>
            </div>
            <input 
              id="log-image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {['service', 'repair', 'chain-lube', 'wash'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t as any)}
                  className={cn(
                    "py-2 px-3 rounded-xl text-xs font-medium border transition-all",
                    type === t 
                      ? "bg-orange-500 border-orange-500 text-white" 
                      : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  )}
                >
                  {t.replace('-', ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Description</label>
            <textarea 
              required
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What was done?"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all h-24 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Mileage (KM)</label>
              <input 
                required
                type="number"
                value={mileage}
                onChange={e => setMileage(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Cost (₹)</label>
              <input 
                type="number"
                value={cost}
                onChange={e => setCost(e.target.value)}
                placeholder="Optional"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              />
            </div>
          </div>
          <button 
            type="submit"
            disabled={uploading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white font-semibold py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/20 mt-4 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading...
              </>
            ) : (
              'Save Log'
            )}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

function MileageForm({ bike, onClose }: { bike: Bike, onClose: () => void }) {
  const [mileage, setMileage] = useState(bike.currentMileage.toString());
  const [trip, setTrip] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newMileage = parseInt(mileage);
      const tripDistance = parseInt(trip) || (newMileage - bike.currentMileage);

      await addDoc(collection(db, 'mileageLogs'), {
        bikeId: bike.id,
        userId: bike.userId,
        date: new Date().toISOString(),
        mileage: newMileage,
        tripDistance
      });

      await updateDoc(doc(db, 'bikes', bike.id), {
        currentMileage: newMileage
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'mileageLogs');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-xl font-bold">Log Ride</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">New Total KM</label>
            <input 
              required
              type="number"
              value={mileage}
              onChange={e => setMileage(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-2xl font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
            />
            <p className="text-xs text-zinc-500">Current: {bike.currentMileage.toLocaleString()} KM</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Trip Distance (Optional)</label>
            <input 
              type="number"
              value={trip}
              onChange={e => setTrip(e.target.value)}
              placeholder="Calculated automatically if empty"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/20 mt-4"
          >
            Update Mileage
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

function FuelLogForm({ bike, onClose }: { bike: Bike, onClose: () => void }) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [cost, setCost] = useState('');
  const [quantity, setQuantity] = useState('');
  const [mileage, setMileage] = useState(bike.currentMileage.toString());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let imageUrl = '';
      if (imageFile) {
        const storageRef = ref(storage, `fuel/${bike.userId}/${Date.now()}_${imageFile.name}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      const fuelCost = parseFloat(cost);
      const fuelQty = parseFloat(quantity);
      const currentMileage = parseInt(mileage);

      await addDoc(collection(db, 'fuelLogs'), {
        bikeId: bike.id,
        userId: bike.userId,
        date,
        cost: fuelCost,
        quantity: fuelQty,
        mileage: currentMileage,
        imageUrl
      });

      // Update bike mileage if it's higher
      if (currentMileage > bike.currentMileage) {
        await updateDoc(doc(db, 'bikes', bike.id), {
          currentMileage
        });
      }

      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'fuelLogs');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-xl font-bold">Log Fuel</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Image Upload */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Fuel Receipt Photo</label>
            <div 
              onClick={() => document.getElementById('fuel-image')?.click()}
              className="relative aspect-video bg-zinc-800 border-2 border-dashed border-zinc-700 rounded-2xl overflow-hidden cursor-pointer hover:border-orange-500/50 transition-all group"
            >
              {imagePreview ? (
                <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
                  <Camera className="w-8 h-8" />
                  <span className="text-xs font-bold uppercase tracking-widest">Upload Photo</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-8 h-8 text-white" />
              </div>
            </div>
            <input 
              id="fuel-image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Date</label>
              <input 
                required
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Mileage (KM)</label>
              <input 
                required
                type="number"
                value={mileage}
                onChange={e => setMileage(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Total Cost (₹)</label>
              <input 
                required
                type="number"
                step="0.01"
                value={cost}
                onChange={e => setCost(e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Quantity (L)</label>
              <input 
                required
                type="number"
                step="0.01"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              />
            </div>
          </div>
          <button 
            type="submit"
            disabled={submitting}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white font-semibold py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/20 mt-4 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Log Fuel'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

function ReminderForm({ bike, onClose }: { bike: Bike, onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<Reminder['type']>('maintenance');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reminders'), {
        bikeId: bike.id,
        userId: bike.userId,
        title,
        date,
        type,
        isCompleted: false
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reminders');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-xl font-bold">Add Reminder</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Title</label>
            <input 
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Insurance Renewal"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Date</label>
            <input 
              required
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {['insurance', 'registration', 'maintenance', 'other'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t as any)}
                  className={cn(
                    "py-2 px-3 rounded-xl text-xs font-medium border transition-all",
                    type === t 
                      ? "bg-orange-500 border-orange-500 text-white" 
                      : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  )}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <button 
            type="submit"
            disabled={submitting}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white font-semibold py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/20 mt-4 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Set Reminder'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

function DeleteConfirmModal({ bikeId, bikeName, onClose, onDeleted }: { bikeId: string, bikeName: string, onClose: () => void, onDeleted: () => void }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'bikes', bikeId));
      onDeleted();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bikes/${bikeId}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-8 text-center space-y-6"
      >
        <div className="flex justify-center">
          <div className="bg-red-500/10 p-4 rounded-full">
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white">Delete {bikeName}?</h3>
          <p className="text-zinc-400 text-sm">This action cannot be undone. All maintenance logs for this bike will remain in history but the bike profile will be removed.</p>
        </div>
        <div className="flex flex-col gap-3 pt-2">
          <button 
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Yes, Delete Bike'}
          </button>
          <button 
            onClick={onClose}
            disabled={isDeleting}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-4 rounded-2xl transition-all"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ImageModal({ imageUrl, onClose }: { imageUrl: string, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative max-w-4xl w-full aspect-auto rounded-3xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <img src={imageUrl} className="w-full h-full object-contain" alt="Full size" />
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-white/10 text-white rounded-full backdrop-blur-md transition-all"
        >
          <X className="w-6 h-6" />
        </button>
      </motion.div>
    </motion.div>
  );
}
