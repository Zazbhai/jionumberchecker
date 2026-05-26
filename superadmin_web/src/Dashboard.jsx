import React, { useContext, useEffect, useState, useRef } from 'react';
import { AuthContext } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Plus, Trash2, Shield, User as UserIcon, Edit2, X, Copy, Check, Loader } from 'lucide-react';

export default function Dashboard() {
  const { user, setUser, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({ username: '', password: '', role: 'user' });
  const [isEditing, setIsEditing] = useState(null);
  const [error, setError] = useState('');

  // SMS Panel States
  const [activeTab, setActiveTab] = useState('sms');
  const [numCount, setNumCount] = useState(1);
  const [maxRetries, setMaxRetries] = useState(10);
  const [requesting, setRequesting] = useState(false);
  const [activeSims, setActiveSims] = useState([]);
  const getLogsKey = () => `activity_logs_${user?.username || 'anonymous'}`;
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(getLogsKey());
      if (stored) {
        setLogs(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Error loading logs:", e);
    }
  }, [user?.username]);
  const [balance, setBalance] = useState('0.00');
  const [price, setPrice] = useState('4.50');
  const [autoCancelTime, setAutoCancelTime] = useState(180);
  const [pollingDelay, setPollingDelay] = useState(2);
  const [allowCancelTime, setAllowCancelTime] = useState(30);
  const [autoCancelTimeStr, setAutoCancelTimeStr] = useState('3');
  const [pollingDelayStr, setPollingDelayStr] = useState('2');
  const [allowCancelTimeStr, setAllowCancelTimeStr] = useState('0.5');
  const pollingIntervals = useRef({});
  const activeSimsRef = useRef([]);
  const simsSectionRef = useRef(null);

  const scrollToSimsSection = () => {
    setTimeout(() => {
      simsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };
  useEffect(() => {
    activeSimsRef.current = activeSims;
  }, [activeSims]);

  // SMS API Configurations
  const [settingsForm, setSettingsForm] = useState({
    base_url: '',
    operator: '',
    country: '',
    service: '',
    auto_cancel_time: '180',
    polling_delay: '2',
    allow_cancel_time: '30',
    price: '4.50'
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Personal API Key State
  const [myApiKey, setMyApiKey] = useState('');
  const [myApiKeySaving, setMyApiKeySaving] = useState(false);
  const [myApiKeySuccess, setMyApiKeySuccess] = useState(false);
  const [myApiKeyError, setMyApiKeyError] = useState('');

  // Orders State
  const [allOrders, setAllOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const isSuperadmin = user?.role === 'superadmin';
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const addLog = (text, type = 'info') => {
    const timeStr = new Date().toLocaleTimeString();
    setLogs(prev => {
      const updated = [{ id: Date.now() + Math.random(), time: timeStr, text, type }, ...prev];
      return updated.slice(0, 200);
    });
  };

  useEffect(() => {
    if (!user?.username) return;
    try {
      localStorage.setItem(getLogsKey(), JSON.stringify(logs));
    } catch (e) {
      console.error("Error persisting logs:", e);
    }
  }, [logs, user?.username]);

  const fetchBalance = async () => {
    try {
      const res = await fetch('http://localhost:5001/api/sms/balance', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.balance !== null && data.balance !== undefined) {
          setBalance(parseFloat(data.balance).toFixed(2));
        }
      }
    } catch (e) {
      console.error("Error fetching balance:", e);
    }
  };

  const fetchPrice = async () => {
    try {
      const res = await fetch('http://localhost:5001/api/sms/price', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.price) {
          setPrice(parseFloat(data.price).toFixed(2));
        }
      }
    } catch (e) {
      console.error("Error fetching price:", e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:5001/api/sms/settings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSettingsForm(data);
        if (data.auto_cancel_time) {
          const val = parseInt(data.auto_cancel_time) || 180;
          setAutoCancelTime(val);
          setAutoCancelTimeStr((val / 60).toString());
        }
        if (data.polling_delay) {
          setPollingDelay(parseInt(data.polling_delay) || 2);
          setPollingDelayStr(data.polling_delay);
        }
        if (data.allow_cancel_time) {
          const val = parseInt(data.allow_cancel_time) || 30;
          setAllowCancelTime(val);
          setAllowCancelTimeStr((val / 60).toString());
        }
      }
    } catch (e) {
      console.error("Error fetching settings:", e);
    }
  };

  const handleTimerStrChange = async (key, val) => {
    if (key === 'auto_cancel_time') {
      setAutoCancelTimeStr(val);
      const minVal = parseFloat(val) || 0;
      const sec = Math.round(minVal * 60);
      setAutoCancelTime(sec);
      
      const updatedSettings = { ...settingsForm, [key]: sec.toString() };
      setSettingsForm(updatedSettings);
      await saveSettingsToBackend(updatedSettings);
    } else if (key === 'polling_delay') {
      setPollingDelayStr(val);
      const sec = parseInt(val) || 0;
      setPollingDelay(sec);
      
      const updatedSettings = { ...settingsForm, [key]: val };
      setSettingsForm(updatedSettings);
      await saveSettingsToBackend(updatedSettings);
    } else if (key === 'allow_cancel_time') {
      setAllowCancelTimeStr(val);
      const minVal = parseFloat(val) || 0;
      const sec = Math.round(minVal * 60);
      setAllowCancelTime(sec);
      
      const updatedSettings = { ...settingsForm, [key]: sec.toString() };
      setSettingsForm(updatedSettings);
      await saveSettingsToBackend(updatedSettings);
    }
  };

  const saveSettingsToBackend = async (updatedSettings) => {
    try {
      await fetch('http://localhost:5001/api/sms/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings),
        credentials: 'include'
      });
    } catch (e) {
      console.error("Error saving setting:", e);
    }
  };

  const fetchMyApiKey = async () => {
    try {
      const res = await fetch('http://localhost:5001/api/auth/api-key', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMyApiKey(data.api_key || '');
      }
    } catch (e) {
      console.error("Error fetching personal API key:", e);
    }
  };

  const handleSaveMyApiKey = async () => {
    setMyApiKeySaving(true);
    setMyApiKeySuccess(false);
    setMyApiKeyError('');
    try {
      const res = await fetch('http://localhost:5001/api/auth/api-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: myApiKey }),
        credentials: 'include'
      });
      if (res.ok) {
        setMyApiKeySuccess(true);
        addLog("Personal API key updated successfully.", "success");
        setTimeout(() => setMyApiKeySuccess(false), 3000);
      } else {
        const errData = await res.json();
        setMyApiKeyError(errData.error || 'Failed to save');
      }
    } catch (err) {
      setMyApiKeyError(err.message);
    } finally {
      setMyApiKeySaving(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess(false);
    try {
      const res = await fetch('http://localhost:5001/api/sms/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
        credentials: 'include'
      });
      if (res.ok) {
        setSettingsSuccess(true);
        addLog("API credentials and settings updated successfully.", "success");
        fetchBalance();
        fetchPrice();
        if (settingsForm.auto_cancel_time) {
          const val = parseInt(settingsForm.auto_cancel_time) || 180;
          setAutoCancelTime(val);
          setAutoCancelTimeStr((val / 60).toString());
        }
        if (settingsForm.polling_delay) {
          setPollingDelay(parseInt(settingsForm.polling_delay) || 2);
          setPollingDelayStr(settingsForm.polling_delay);
        }
        if (settingsForm.allow_cancel_time) {
          const val = parseInt(settingsForm.allow_cancel_time) || 30;
          setAllowCancelTime(val);
          setAllowCancelTimeStr((val / 60).toString());
        }
        setTimeout(() => setSettingsSuccess(false), 3000);
      } else {
        addLog("Failed to save settings.", "error");
      }
    } catch (err) {
      addLog(`Error saving settings: ${err.message}`, "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchActiveOrders = async (limit = 180) => {
    try {
      const res = await fetch('http://localhost:5001/api/sms/orders', { credentials: 'include' });
      if (res.ok) {
        const orders = await res.json();
        const activeOrders = [];
        
        for (const order of orders) {
          if (order.status === 'active' || order.status === 'completed') {
            const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000);
            if (elapsed < limit) {
              const timeLeft = limit - elapsed;
              activeOrders.push({
                request_id: order.request_id,
                number: order.number,
                status: order.status,
                createdAt: new Date(order.created_at),
                timeLeft: timeLeft,
                price: order.price,
                messages: order.messages.map(m => ({
                  id: m.id,
                  otp: m.otp,
                  text: m.text,
                  receivedAt: new Date(m.received_at)
                }))
              });
              if (order.status === 'active') {
                startPolling(order.request_id);
              }
            } else if (order.status === 'active') {
              // Cancel it on backend
              fetch(`http://localhost:5001/api/sms/cancel/${order.request_id}`, {
                method: 'POST',
                credentials: 'include'
              });
            }
          }
        }
        
        if (activeOrders.length > 0) {
          setActiveSims(activeOrders);
          addLog(`Restored ${activeOrders.length} active SIM(s) from database.`, 'success');
        }
      }
    } catch (err) {
      console.error("Error restoring active orders:", err);
    }
  };

  const fetchAllOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch('http://localhost:5001/api/sms/orders', { credentials: 'include' });
      if (res.ok) {
        setAllOrders(await res.json());
      }
    } catch (e) {
      console.error("Error fetching orders:", e);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      navigate('/login');
      return;
    }
    
    if (user.role === 'superadmin' || user.role === 'admin') {
      fetchUsers();
    }

    const init = async () => {
      let currentLimit = 180;
      try {
        const settingsRes = await fetch('http://localhost:5001/api/sms/settings', { credentials: 'include' });
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setSettingsForm(data);
          if (data.auto_cancel_time) {
            const val = parseInt(data.auto_cancel_time) || 180;
            setAutoCancelTime(val);
            setAutoCancelTimeStr((val / 60).toString());
            currentLimit = val;
          }
          if (data.polling_delay) {
            const val = parseInt(data.polling_delay) || 2;
            setPollingDelay(val);
            setPollingDelayStr(data.polling_delay);
          }
          if (data.allow_cancel_time) {
            const val = parseInt(data.allow_cancel_time) || 30;
            setAllowCancelTime(val);
            setAllowCancelTimeStr((val / 60).toString());
          }
        }
      } catch (e) {
        console.error("Error fetching settings:", e);
      }
      
      fetchBalance();
      fetchPrice();
      fetchActiveOrders(currentLimit);
      fetchMyApiKey();
    };

    init();
  }, [user, loading]);

  // Fetch all orders when switching to orders tab
  useEffect(() => {
    if (activeTab === 'orders') {
      fetchAllOrders();
    }
  }, [activeTab]);

  // Timer countdown and intervals cleanup
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSims(prev => prev.map(sim => {
        if (sim.status === 'active' && sim.timeLeft > 0) {
          const nextTime = sim.timeLeft - 1;
          if (nextTime === 0) {
            stopPolling(sim.request_id);
            addLog(`[SIM +91${sim.number}] Session auto-cancelled (Auto Cancel Time reached).`, 'info');
            // Auto cancel it on the backend
            fetch(`http://localhost:5001/api/sms/cancel/${sim.request_id}`, {
              method: 'POST',
              credentials: 'include'
            }).then(() => fetchBalance());
            return { ...sim, timeLeft: 0, status: 'cancelled' };
          }
          return { ...sim, timeLeft: nextTime };
        }
        return sim;
      }));
    }, 1000);

    return () => {
      clearInterval(timer);
      Object.values(pollingIntervals.current).forEach(clearInterval);
    };
  }, []);

  const startPolling = (requestId) => {
    if (pollingIntervals.current[requestId]) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:5001/api/sms/otp-status/${requestId}`, {
          credentials: 'include'
        });
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'ok' && data.otp) {
          stopPolling(requestId);
          
          const simFound = activeSimsRef.current.find(s => s.request_id === requestId);
          if (!simFound || simFound.status !== 'active') {
            return; // SIM was already cancelled/expired by timer — discard stale poll result
          }
          const numberVal = simFound.number;
          const alreadyExists = simFound.messages.some(m => m.otp === data.otp);

          addLog(`[SIM +91${numberVal}] Received OTP: ${data.otp}. Automatically requesting next OTP...`, 'success');
          
          setActiveSims(prev => {
            return prev.map(s => {
              if (s.request_id === requestId) {
                const newMessages = alreadyExists ? s.messages : [
                  ...s.messages,
                  {
                    id: Date.now() + Math.random(),
                    otp: data.otp,
                    text: data.raw || `Verification code received: ${data.otp}`,
                    receivedAt: new Date()
                  }
                ];
                return {
                  ...s,
                  status: 'active',
                  messages: newMessages
                };
              }
              return s;
            });
          });

          // Automatically trigger request for next OTP as requested
          triggerNextOtp(requestId, numberVal);
        } else if (data.status === 'cancelled') {
          addLog(`[SIM] Request ID ${requestId} has been cancelled/released by server.`, 'error');
          stopPolling(requestId);
          setActiveSims(prev => prev.map(s => {
            if (s.request_id === requestId) {
              return { ...s, status: 'cancelled' };
            }
            return s;
          }));
        }
      } catch (e) {
        console.error("Error polling OTP:", e);
      }
    }, pollingDelay * 1000);

    pollingIntervals.current[requestId] = interval;
  };

  const stopPolling = (requestId) => {
    if (pollingIntervals.current[requestId]) {
      clearInterval(pollingIntervals.current[requestId]);
      delete pollingIntervals.current[requestId];
    }
  };

  // Restart polling when pollingDelay changes to keep timers in sync
  useEffect(() => {
    activeSims.forEach(sim => {
      if (sim.status === 'active') {
        stopPolling(sim.request_id);
        startPolling(sim.request_id);
      }
    });
  }, [pollingDelay]);

  const triggerNextOtp = async (requestId, number) => {
    const sim = activeSimsRef.current.find(s => s.request_id === requestId);
    if (!sim || sim.status !== 'active') {
      return; // SIM no longer active — don't request new OTP
    }
    addLog(`[SIM +91${number}] Triggering next OTP cycle and resuming polling...`, 'info');
    try {
      const res = await fetch(`http://localhost:5001/api/sms/next-otp/${requestId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        addLog(`[SIM +91${number}] API setStatus=3 success. Waiting for next message.`, 'success');
        
        setActiveSims(prev => prev.map(s => {
          if (s.request_id === requestId) {
            return { ...s, status: 'active' };
          }
          return s;
        }));
        
        startPolling(requestId);
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.reason === 'order_no_longer_active') {
          addLog(`[SIM +91${number}] Order no longer active — marking as cancelled.`, 'error');
          setActiveSims(prev => prev.map(s => {
            if (s.request_id === requestId) {
              return { ...s, status: 'cancelled' };
            }
            return s;
          }));
        } else {
          addLog(`[SIM +91${number}] API status=3 request failed.`, 'error');
        }
      }
    } catch (err) {
      console.error("Error triggering next otp:", err);
    }
  };

  const handleRequestNumbers = async () => {
    if (requesting) return;
    setRequesting(true);
    const targetCount = Math.min(20, Math.max(1, parseInt(numCount) || 1));
    const retriesLimit = Math.max(0, parseInt(maxRetries) || 0);
    
    addLog(`Requesting ${targetCount} registered numbers from API (Max Retries: ${retriesLimit})...`, 'info');

    let registeredCount = 0;
    let retryCount = 0;
    let attempt = 1;

    while (registeredCount < targetCount && retryCount <= retriesLimit) {
      const attemptStr = `[Request ${registeredCount + 1}/${targetCount}] (Attempt ${attempt}, Retries used: ${retryCount}/${retriesLimit})`;
      
      addLog(`${attemptStr} Fetching number...`, 'info');
      try {
        const res = await fetch('http://localhost:5001/api/sms/request-number', {
          method: 'POST',
          credentials: 'include'
        });
        const data = await res.json();

        if (res.ok) {
          if (data.status === 'registered') {
            addLog(`${attemptStr} Number +91${data.number} is Jio registered!`, 'success');
            const newSim = {
              request_id: data.request_id,
              number: data.number,
              status: 'active',
              createdAt: new Date(),
              timeLeft: autoCancelTime,
              price: price,
              messages: []
            };
            setActiveSims(prev => [newSim, ...prev]);
            registeredCount++;
            startPolling(data.request_id);
            scrollToSimsSection();
          } else {
            addLog(`${attemptStr} Number +91${data.number} not registered (Jio: ${data.jio_status || 'no'}). Automatically cancelled.`, 'error');
            retryCount++;
          }
        } else {
          addLog(`${attemptStr} Request failed: ${data.error || 'Unknown error'}`, 'error');
          retryCount++;
        }
      } catch (err) {
        addLog(`${attemptStr} Connection error: ${err.message}`, 'error');
        retryCount++;
      }
      
      attempt++;
      
      // Stop loop if we hit limit
      if (registeredCount < targetCount && retryCount > retriesLimit) {
        addLog(`Reached retry limit of ${retriesLimit}. Stopping.`, 'error');
        break;
      }
      
      // Delay to avoid spamming the APIs too fast
      await new Promise(r => setTimeout(r, 1000));
    }

    addLog(`Finished. Added ${registeredCount} registered numbers.`, registeredCount > 0 ? 'success' : 'info');
    setRequesting(false);
    fetchBalance();
  };

  const handleCancelSim = async (requestId, number) => {
    const sim = activeSimsRef.current.find(s => s.request_id === requestId);
    if (!sim || sim.status !== 'active') {
      addLog(`Number +91${number} is no longer active.`, 'info');
      return;
    }
    addLog(`Cancelling number +91${number}...`, 'info');
    try {
      const res = await fetch(`http://localhost:5001/api/sms/cancel/${requestId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        addLog(`Number +91${number} cancelled/released.`, 'success');
        stopPolling(requestId);
        setActiveSims(prev => prev.map(sim => {
          if (sim.request_id === requestId) {
            return { ...sim, status: 'cancelled' };
          }
          return sim;
        }));
        fetchBalance();
      } else {
        addLog(`Failed to cancel number +91${number}.`, 'error');
      }
    } catch (err) {
      addLog(`Error cancelling number: ${err.message}`, 'error');
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('http://localhost:5001/api/users', { credentials: 'include' });
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    await fetch('http://localhost:5001/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    navigate('/login');
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setError('');
    
    const url = isEditing 
      ? `http://localhost:5001/api/users/${isEditing}`
      : `http://localhost:5001/api/users`;
      
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });
      
      if (res.ok) {
        setShowModal(false);
        fetchUsers();
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to save');
      }
    } catch (e) {
      setError('Network error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      const res = await fetch(`http://localhost:5001/api/users/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openNewModal = () => {
    setIsEditing(null);
    setFormData({ username: '', password: '', role: 'user' });
    setError('');
    setShowModal(true);
  };

  const openEditModal = (u) => {
    setIsEditing(u.id);
    setFormData({ username: u.username, password: '', role: u.role });
    setError('');
    setShowModal(true);
  };

  const renderSmsPanel = () => {
    return (
      <div className="sms-panel-container">
        {/* Top controls and logger */}
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          
          {/* Controls box */}
          <div className="glass-card" style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>Request Virtual Numbers</h3>
            <div className="sms-controls" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr', gap: '0.75rem', width: '100%' }}>
              <div className="sms-control-group">
                <label>SIM Count</label>
                <input 
                  type="number" 
                  min="1" 
                  max="20"
                  className="input-field" 
                  value={numCount} 
                  onChange={e => setNumCount(e.target.value)}
                  disabled={requesting}
                />
              </div>
              <div className="sms-control-group">
                <label>Max Retries</label>
                <input 
                  type="number" 
                  min="0" 
                  max="100"
                  className="input-field" 
                  value={maxRetries} 
                  onChange={e => setMaxRetries(e.target.value)}
                  disabled={requesting}
                />
              </div>
            </div>

            <div className="sms-controls" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', width: '100%' }}>
              <div className="sms-control-group">
                <label style={{ fontSize: '0.75rem' }}>Auto Cancel (m)</label>
                <input 
                  type="number" 
                  step="any"
                  min="0"
                  className="input-field" 
                  value={autoCancelTimeStr} 
                  onChange={e => handleTimerStrChange('auto_cancel_time', e.target.value)}
                  disabled={requesting || !isAdmin}
                  style={{ padding: '0.4rem' }}
                />
              </div>
              <div className="sms-control-group">
                <label style={{ fontSize: '0.75rem' }}>Poll Delay (s)</label>
                <input 
                  type="number" 
                  min="1"
                  className="input-field" 
                  value={pollingDelayStr} 
                  onChange={e => handleTimerStrChange('polling_delay', e.target.value)}
                  disabled={requesting || !isAdmin}
                  style={{ padding: '0.4rem' }}
                />
              </div>
              <div className="sms-control-group">
                <label style={{ fontSize: '0.75rem' }}>Allow Cancel (m)</label>
                <input 
                  type="number" 
                  step="any"
                  min="0"
                  className="input-field" 
                  value={allowCancelTimeStr} 
                  onChange={e => handleTimerStrChange('allow_cancel_time', e.target.value)}
                  disabled={requesting || !isAdmin}
                  style={{ padding: '0.4rem' }}
                />
              </div>
            </div>
            
            <button 
              className="btn btn-primary" 
              onClick={handleRequestNumbers}
              disabled={requesting}
              style={{ width: '100%', height: '42px', marginTop: '0.5rem' }}
            >
              {requesting ? (
                <>
                  <Loader className="animate-spin" size={16} style={{ marginRight: '4px' }} /> Checking SIMs...
                </>
              ) : (
                <>
                  <Plus size={16} /> Request Numbers
                </>
              )}
            </button>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Cost (Approx):</span>
              <span style={{ color: '#10b981', fontWeight: 'bold' }}>₹{price} / SIM</span>
            </div>
          </div>

          {/* Log viewer */}
          <div className="progress-log-card" style={{ flex: '2 2 500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>Activity Logs</h3>
              <button 
                className="btn" 
                style={{ padding: '2px 8px', fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                onClick={() => { setLogs([]); try { localStorage.removeItem(getLogsKey()); } catch {} }}
              >
                Clear Logs
              </button>
            </div>
            <div className="progress-log-list">
              {logs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                  Awaiting activity. Select quantity and request virtual SIMs.
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className={`log-item ${log.type}`}>
                    [{log.time}] {log.text}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* SIM cards grid */}
        <div ref={simsSectionRef}>
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
            Active SIM Cards
            <span style={{ fontSize: '0.85rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
              {activeSims.filter(s => s.status === 'active').length} Active
            </span>
          </h3>

          {activeSims.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>No virtual numbers loaded.</p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>Only numbers verifying as registered on Jio will be shown here.</p>
            </div>
          ) : (
            <div className="sms-grid">
              {activeSims.map(sim => (
                <SIMCard 
                  key={sim.request_id} 
                  sim={sim} 
                  onCancel={handleCancelSim} 
                  onRequestNewOtp={triggerNextOtp}
                  autoCancelTime={autoCancelTime}
                  allowCancelTime={allowCancelTime}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSettingsPanel = () => {
    return (
      <>
        {/* Personal API Key (all users) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="glass-card" 
          style={{ maxWidth: '600px', margin: '0 auto 1.5rem' }}
        >
          <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'white' }}>Your Personal API Key</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Set your own API key to override the global one. Leave empty to use the global API key configured by the admin.
          </p>

          {myApiKeySuccess && (
            <div style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px 14px', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Personal API key saved!
            </div>
          )}
          {myApiKeyError && (
            <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px 14px', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
              {myApiKeyError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Personal API Key</label>
              <input 
                type="text"
                className="input-field" 
                value={myApiKey} 
                onChange={e => setMyApiKey(e.target.value)}
                placeholder="Enter your personal API key"
              />
            </div>
            <button 
              className="btn btn-primary" 
              onClick={handleSaveMyApiKey}
              disabled={myApiKeySaving}
              style={{ height: '38px', whiteSpace: 'nowrap' }}
            >
              {myApiKeySaving ? (
                <><Loader className="animate-spin" size={14} style={{ marginRight: '4px' }} /> Saving</>
              ) : 'Save'}
            </button>
          </div>
        </motion.div>

        {/* Global Admin Settings */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="glass-card" 
          style={{ maxWidth: '600px', margin: '0 auto' }}
        >
          <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'white' }}>API Configurations</h2>
          
          {settingsSuccess && (
            <div style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px 14px', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Configurations saved successfully! Recalculating balance and pricing.
            </div>
          )}

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Base API URL</label>
            <input 
              className="input-field" 
              value={settingsForm.base_url} 
              onChange={e => setSettingsForm({...settingsForm, base_url: e.target.value})} 
              disabled={!isAdmin}
              required 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Operator Code</label>
              <input 
                className="input-field" 
                value={settingsForm.operator} 
                onChange={e => setSettingsForm({...settingsForm, operator: e.target.value})} 
                disabled={!isAdmin}
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Country Code</label>
              <input 
                className="input-field" 
                value={settingsForm.country} 
                onChange={e => setSettingsForm({...settingsForm, country: e.target.value})} 
                disabled={!isAdmin}
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Service Code</label>
              <input 
                className="input-field" 
                value={settingsForm.service} 
                onChange={e => setSettingsForm({...settingsForm, service: e.target.value})} 
                disabled={!isAdmin}
                required 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Auto Cancel Time (m)</label>
              <input 
                type="number"
                step="any"
                className="input-field" 
                value={autoCancelTimeStr} 
                onChange={e => handleTimerStrChange('auto_cancel_time', e.target.value)} 
                disabled={!isAdmin}
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Polling Delay (s)</label>
              <input 
                type="number"
                className="input-field" 
                value={pollingDelayStr} 
                onChange={e => handleTimerStrChange('polling_delay', e.target.value)} 
                disabled={!isAdmin}
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Allow Cancel Time (m)</label>
              <input 
                type="number"
                step="any"
                className="input-field" 
                value={allowCancelTimeStr} 
                onChange={e => handleTimerStrChange('allow_cancel_time', e.target.value)} 
                disabled={!isAdmin}
                required 
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Price per SIM (₹)</label>
            <input 
              type="number" 
              step="0.01" 
              min="0"
              className="input-field" 
              value={settingsForm.price || '4.50'} 
              onChange={e => setSettingsForm({...settingsForm, price: e.target.value})} 
              disabled={!isSuperadmin} 
              required 
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ marginTop: '1rem', width: '100%', height: '42px' }}
            disabled={savingSettings || !isAdmin}
          >
            {savingSettings ? (
              <>
                <Loader className="animate-spin" size={16} style={{ marginRight: '4px' }} /> Saving Configurations...
              </>
            ) : (
              'Save Configurations'
            )}
          </button>
        </form>
      </motion.div>
      </>
    );
  };

  const renderOrdersPanel = () => {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: 'white' }}>Order History</h2>
          <button 
            className="btn" 
            style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} 
            onClick={fetchAllOrders}
            disabled={loadingOrders}
          >
            {loadingOrders ? <Loader className="animate-spin" size={12} /> : 'Refresh'}
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Phone Number</th>
                <th>Price</th>
                <th>Created At</th>
                <th>Status</th>
                <th>Messages</th>
              </tr>
            </thead>
            <tbody>
              {loadingOrders ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                    <Loader className="animate-spin" size={24} style={{ margin: '0 auto' }} />
                  </td>
                </tr>
              ) : allOrders.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No orders found. Request virtual numbers to start.
                  </td>
                </tr>
              ) : (
                allOrders.map(order => {
                  const isExpanded = expandedOrderId === order.id;
                  return (
                    <React.Fragment key={order.id}>
                      <tr 
                        style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="order-row-hover"
                      >
                        <td style={{ fontWeight: 'bold' }}>+{order.number.startsWith('91') ? '' : '91'}{order.number}</td>
                        <td style={{ color: '#10b981', fontWeight: 'bold' }}>₹{parseFloat(order.price).toFixed(2)}</td>
                        <td>{new Date(order.created_at).toLocaleString()}</td>
                        <td>
                          <span className="badge"
                                style={{
                                  background: order.status === 'active' ? 'rgba(59, 130, 246, 0.15)' : order.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: order.status === 'active' ? '#3b82f6' : order.status === 'completed' ? '#10b981' : '#ef4444',
                                  borderColor: order.status === 'active' ? 'rgba(59, 130, 246, 0.3)' : order.status === 'completed' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                                  borderWidth: '1px',
                                  borderStyle: 'solid',
                                  fontSize: '11px',
                                  fontWeight: 'bold'
                                }}
                          >
                            {order.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {order.messages.length} SMS {isExpanded ? '▲' : '▼'}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan="5" style={{ background: 'rgba(0,0,0,0.15)', padding: '1.25rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'white' }}>SMS Messages Log</h4>
                              {order.messages.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                  No SMS messages received for this session.
                                </div>
                              ) : (
                                order.messages.map(msg => (
                                  <div key={msg.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                      <span>Received</span>
                                      <span>{new Date(msg.received_at).toLocaleTimeString()}</span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'white' }}>{msg.text}</div>
                                    {msg.otp && (
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginTop: '6px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '4px 8px', borderRadius: '4px' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#93c5fd', fontWeight: 'bold' }}>OTP:</span>
                                        <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 'bold', color: '#60a5fa' }}>{msg.otp}</span>
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader className="animate-spin" size={48} style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <header className="header">
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Dashboard</h1>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>
            Welcome back, <span style={{ color: 'white' }}>{user?.username}</span>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="balance-display-header">
            <span>SMS Balance:</span>
            <span className="balance-value">₹{balance}</span>
          </div>
          <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={handleLogout}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </header>

      {user?.role !== 'user' ? (
        <div className="tab-nav">
          <button 
            className={`tab-btn ${activeTab === 'sms' ? 'active' : ''}`}
            onClick={() => setActiveTab('sms')}
          >
            SMS Panel
          </button>
          <button 
            className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            Orders
          </button>
          <button 
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            User Management
          </button>
          <button 
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            API Settings
          </button>
        </div>
      ) : (
        <div className="tab-nav">
          <button 
            className={`tab-btn ${activeTab === 'sms' ? 'active' : ''}`}
            onClick={() => setActiveTab('sms')}
          >
            SMS Panel
          </button>
          <button 
            className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            Orders
          </button>
          <button 
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            API Settings
          </button>
        </div>
      )}

      {user?.role === 'user' ? (
        activeTab === 'settings' ? renderSettingsPanel() : activeTab === 'orders' ? renderOrdersPanel() : renderSmsPanel()
      ) : activeTab === 'sms' ? (
        renderSmsPanel()
      ) : activeTab === 'settings' ? (
        renderSettingsPanel()
      ) : activeTab === 'orders' ? (
        renderOrdersPanel()
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0 }}>User Management</h2>
            {isSuperadmin && (
              <button className="btn btn-primary" onClick={openNewModal}>
                <Plus size={18} /> Add User
              </button>
            )}
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th style={{ textAlign: 'center' }}>Active</th>
                  <th style={{ textAlign: 'center' }}>Completed</th>
                  <th style={{ textAlign: 'center' }}>Cancelled</th>
                  <th style={{ textAlign: 'center' }}>Expired</th>
                  {isSuperadmin && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {users.map(u => (
                    <motion.tr 
                      key={u.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserIcon size={16} />
                          </div>
                          {u.username}
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${u.role}`}>
                          {u.role === 'superadmin' && <Shield size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-top' }} />}
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: '1.1rem' }}>{u.active_count ?? 0}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.1rem' }}>{u.completed_count ?? 0}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '1.1rem' }}>{u.cancelled_count ?? 0}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '1.1rem' }}>{u.expired_count ?? 0}</span>
                      </td>
                      {isSuperadmin && (
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn" style={{ background: 'transparent', color: 'var(--text-muted)', padding: '0.5rem' }} onClick={() => openEditModal(u)}>
                            <Edit2 size={16} />
                          </button>
                          <button className="btn" style={{ background: 'transparent', color: 'var(--danger)', padding: '0.5rem' }} onClick={() => handleDelete(u.id)}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card" 
              style={{ width: '400px', maxWidth: '90%', position: 'relative' }}
            >
              <button 
                onClick={() => setShowModal(false)}
                style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
              
              <h3 style={{ marginTop: 0 }}>{isEditing ? 'Edit User' : 'New User'}</h3>
              
              {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}
              
              <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Username</label>
                  <input className="input-field" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    Password {isEditing && <span style={{ fontSize: '0.75rem' }}>(leave blank to keep current)</span>}
                  </label>
                  <input className="input-field" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!isEditing} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Role</label>
                  <select className="input-field" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} style={{ appearance: 'none' }}>
                    <option value="user" style={{ background: '#0f172a' }}>User</option>
                    <option value="admin" style={{ background: '#0f172a' }}>Admin</option>
                    <option value="superadmin" style={{ background: '#0f172a' }}>Superadmin</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                  {isEditing ? 'Save Changes' : 'Create User'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SIMCard({ sim, onCancel, onRequestNewOtp, autoCancelTime, allowCancelTime }) {
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`+91${sim.number}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    await onCancel(sim.request_id, sim.number);
    setCancelling(false);
  };

  const handleNewOtp = async () => {
    if (requestingOtp) return;
    setRequestingOtp(true);
    await onRequestNewOtp(sim.request_id, sim.number);
    setRequestingOtp(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Calculate if manual cancellation is allowed (elapsed <= allowCancelTime)
  const elapsed = autoCancelTime - sim.timeLeft;
  const isCancelAllowed = elapsed <= allowCancelTime;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="sms-card"
    >
      <div className="sms-card-header">
        <div className="sms-app-info">
          <div className="sms-app-logo" style={{ background: '#1e40af', color: '#ffffff', fontWeight: 'bold' }}>J</div>
          <div className="sms-app-title-group">
            <span className="sms-app-title">Jio — India</span>
            <span className="sms-app-subtitle">Rapid 3</span>
          </div>
        </div>
        <div className="sms-header-badges">
          {sim.status === 'active' ? (
            <>
              <span className="badge-active">ACTIVE</span>
              <span className="sms-timer">
                <Shield size={12} style={{ display: 'inline', color: '#f59e0b' }} />
                {formatTime(sim.timeLeft)}
              </span>
            </>
          ) : sim.status === 'completed' ? (
            <span className="badge-active" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}>COMPLETED</span>
          ) : sim.status === 'cancelled' ? (
            <span className="badge-cancelled-sim">CANCELLED</span>
          ) : (
            <span className="badge-cancelled-sim" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}>EXPIRED</span>
          )}
        </div>
      </div>

      <div className="sms-phone-container">
        <div className="sms-phone-text-group">
          <span className="sms-phone-label">PHONE NUMBER</span>
          <span className="sms-phone-number">+{sim.number.startsWith('91') ? '' : '91'}{sim.number}</span>
        </div>
        <div className="sms-phone-actions">
          <button 
            className="sms-icon-btn" 
            title="Copy phone number"
            onClick={handleCopy}
          >
            {copied ? <Check size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />}
          </button>
          <button 
            className="sms-icon-btn plus-btn" 
            title="Request new OTP"
            onClick={handleNewOtp}
            disabled={(sim.status !== 'active' && sim.status !== 'completed') || requestingOtp}
          >
            {requestingOtp ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
          </button>
        </div>
      </div>

      <div className="sms-card-details">
        <div>{formatDate(sim.createdAt)}</div>
        <div className="sms-amount-group">
          <span className="sms-amount-label">AMOUNT</span>
          <span className="sms-amount-value">₹{sim.price || '4.50'}</span>
        </div>
      </div>

      <div className="sms-messages-section">
        <div className="sms-messages-header">
          <span className="sms-messages-label">SMS MESSAGES</span>
          <span className="sms-messages-count">{sim.messages.length} MESSAGES</span>
        </div>
        
        <div className="sms-messages-list">
          {sim.messages.length === 0 ? (
            <div className="sms-empty-placeholder">
              <div className="sms-question-icon">?</div>
              <span>Waiting for SMS messages...</span>
            </div>
          ) : (
            sim.messages.map(msg => (
              <div key={msg.id} className="sms-message-bubble">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Incoming Message</span>
                  <span>{new Date(msg.receivedAt).toLocaleTimeString()}</span>
                </div>
                <div className="sms-message-text">{msg.text}</div>
                {msg.otp && (
                  <div className="sms-otp-container">
                    <span className="sms-otp-label">Verification OTP</span>
                    <span className="sms-otp-highlight">{msg.otp}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {sim.status === 'active' && (
        <div className="sms-card-footer-actions">
          <button 
            className="btn btn-danger" 
            style={{ 
              padding: '8px 16px', 
              fontSize: '0.85rem',
              opacity: isCancelAllowed ? 1 : 0.5,
              cursor: isCancelAllowed ? 'pointer' : 'not-allowed'
            }} 
            onClick={handleCancel}
            disabled={cancelling || !isCancelAllowed}
          >
            {cancelling ? <Loader size={14} className="animate-spin" /> : isCancelAllowed ? 'Release / Cancel Number' : 'Release Window Closed'}
          </button>
        </div>
      )}
    </motion.div>
  );
}
