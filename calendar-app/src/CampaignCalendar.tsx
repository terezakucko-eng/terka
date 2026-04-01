import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Edit2, Trash2, Search, Filter, Download, Upload, BarChart3, Calendar, List, Grid, Bell, Clock, AlertTriangle, CheckCircle, X, ExternalLink, RefreshCw, Briefcase } from 'lucide-react';

const BASECAMP_PROXY = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:3001/api'
  : '/api';
const MKT_PROJECT_ID = '45674654';
const TEREZA_PERSON_ID = 43838310;

async function bcFetch(path, options = {}) {
  const res = await fetch(`${BASECAMP_PROXY}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(`Basecamp API ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

async function fetchAllPages(path) {
  const results = [];
  let url = path;
  while (url) {
    const res = await fetch(`${BASECAMP_PROXY}${url}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) break;
    const data = await res.json();
    results.push(...(Array.isArray(data) ? data : []));
    const link = res.headers.get('Link') || '';
    const next = link.match(/<[^>]*\/api([^>]*)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }
  return results;
}

const CampaignCalendar = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [user, setUser] = useState({ name: 'Testovací uživatel', email: 'test@rozovyslon.cz' });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [campaigns, setCampaigns] = useState([
    // Demo data pro testování
    {
      id: 1,
      name: 'Black Friday 2025',
      dateFrom: '2025-08-05',
      dateTo: '2025-08-15',
      channels: ['HP Banner', 'IG - placený post', 'Newsletter'],
      status: 'aktivni',
      countries: ['CZ', 'SK'],
      description: 'Velká slevová akce na konci roku',
      productTableUrl: 'https://example.com/products',
      basecampUrl: 'https://basecamp.com/project',
      colorIndex: 0
    },
    {
      id: 2,
      name: 'Vánoční kampaň',
      dateFrom: '2025-08-08',
      dateTo: '2025-08-20',
      channels: ['TV', 'Rádio', 'SMS'],
      status: 'priprava',
      countries: ['CZ', 'HU'],
      description: 'Vánoční atmosféra a dárky',
      productTableUrl: '',
      basecampUrl: '',
      colorIndex: 1
    }
  ]);
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [viewMode, setViewMode] = useState('calendar');
  const [searchTerm, setSearchTerm] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [draggedCampaign, setDraggedCampaign] = useState(null);
  const [draggedOver, setDraggedOver] = useState(null);
  const [basecampTodos, setBasecampTodos] = useState([]);
  const [basecampLoading, setBasecampLoading] = useState(false);
  const [basecampError, setBasecampError] = useState(null);
  const [basecampLastSync, setBasecampLastSync] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    country: 'all',
    channel: 'all'
  });
  const [formData, setFormData] = useState({
    name: '', dateFrom: '', dateTo: '', channels: [], status: 'priprava',
    countries: ['CZ'], description: '', productTableUrl: '', basecampUrl: ''
  });

  const channels = [
    'HP Banner', 'IG - placený post', 'IG - neplacený post', 'IG - story', 'PPC display', 
    'Newsletter', 'Heureka - display', 'Článek na web', 'SMS', 'Doprava zdarma', 
    'TV', 'Rádio', 'Billboardy', 'Prodejny'
  ];
  
  const statuses = {
    priprava: { label: 'V přípravě', color: 'bg-yellow-200 border-yellow-300 text-yellow-900', icon: Clock },
    kespusteni: { label: 'Ke spuštění', color: 'bg-blue-200 border-blue-300 text-blue-900', icon: AlertTriangle },
    aktivni: { label: 'Aktivní', color: 'bg-green-200 border-green-300 text-green-900', icon: CheckCircle },
    ukoncena: { label: 'Ukončená', color: 'bg-gray-200 border-gray-300 text-gray-700', icon: X }
  };
  
  const countries = ['CZ', 'SK', 'HU', 'RO', 'SI', 'HR', 'BG'];
  const months = ['LEDEN', 'ÚNOR', 'BŘEZEN', 'DUBEN', 'KVĚTEN', 'ČERVEN', 'ČERVENEC', 'SRPEN', 'ZÁŘÍ', 'ŘÍJEN', 'LISTOPAD', 'PROSINEC'];
  const dayNames = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
  
  const campaignColors = [
    'bg-gradient-to-r from-pink-200 to-purple-200 border-pink-400 text-pink-900',
    'bg-gradient-to-r from-purple-200 to-blue-200 border-purple-400 text-purple-900',
    'bg-gradient-to-r from-blue-200 to-cyan-200 border-blue-400 text-blue-900',
    'bg-gradient-to-r from-cyan-200 to-teal-200 border-cyan-400 text-cyan-900',
    'bg-gradient-to-r from-teal-200 to-green-200 border-teal-400 text-teal-900',
    'bg-gradient-to-r from-green-200 to-lime-200 border-green-400 text-green-900'
  ];

  // Notifikace - kontrola blížících se termínů
  useEffect(() => {
    const checkNotifications = () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      const newNotifications = [];
      
      campaigns.forEach(campaign => {
        const startDate = new Date(campaign.dateFrom);
        const endDate = new Date(campaign.dateTo);
        
        // Kampaň končí zítra
        if (endDate.toDateString() === tomorrow.toDateString() && campaign.status === 'aktivni') {
          newNotifications.push({
            id: `end-${campaign.id}`,
            type: 'warning',
            title: 'Kampaň končí zítra',
            message: `Kampaň "${campaign.name}" končí zítra (${endDate.toLocaleDateString('cs-CZ')})`,
            campaign: campaign
          });
        }
        
        // Kampaň začíná zítra
        if (startDate.toDateString() === tomorrow.toDateString() && campaign.status === 'kespusteni') {
          newNotifications.push({
            id: `start-${campaign.id}`,
            type: 'info',
            title: 'Kampaň začíná zítra',
            message: `Kampaň "${campaign.name}" začíná zítra (${startDate.toLocaleDateString('cs-CZ')})`,
            campaign: campaign
          });
        }
        
        // Kampaň začíná během týdne a není připravena
        if (startDate <= nextWeek && startDate > today && campaign.status === 'priprava') {
          newNotifications.push({
            id: `prep-${campaign.id}`,
            type: 'error',
            title: 'Nepřipravená kampaň',
            message: `Kampaň "${campaign.name}" začíná ${startDate.toLocaleDateString('cs-CZ')} a není připravena`,
            campaign: campaign
          });
        }
      });

      setNotifications(newNotifications);
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 60000); // Kontrola každou minutu
    return () => clearInterval(interval);
  }, [campaigns]);

  // Basecamp: načtení todos Terezy přes všechny projekty
  const fetchBasecampTodos = useCallback(async () => {
    setBasecampLoading(true);
    setBasecampError(null);
    try {
      const projects = await fetchAllPages('/projects.json');
      const results = [];
      for (const proj of projects) {
        for (const dock of (proj.dock || [])) {
          if (dock.name !== 'todoset' || !dock.enabled) continue;
          const tsPath = dock.url.replace(/^https:\/\/3\.basecampapi\.com\/3317373/, '');
          try {
            const todoset = await bcFetch(tsPath);
            const tlsPath = todoset.todolists_url.replace(/^https:\/\/3\.basecampapi\.com\/3317373/, '');
            const todolists = await fetchAllPages(tlsPath);
            for (const tl of todolists) {
              const todosPath = tl.todos_url.replace(/^https:\/\/3\.basecampapi\.com\/3317373/, '');
              const todos = await fetchAllPages(todosPath);
              for (const todo of todos) {
                const assigneeIds = (todo.assignees || []).map(a => a.id);
                const creatorId = todo.creator?.id;
                if (assigneeIds.includes(TEREZA_PERSON_ID) || creatorId === TEREZA_PERSON_ID) {
                  results.push({
                    id: todo.id,
                    content: todo.content,
                    completed: todo.completed,
                    due: todo.due_on || null,
                    project: proj.name,
                    projectId: proj.id,
                    list: tl.name,
                    url: todo.app_url,
                    assignees: (todo.assignees || []).map(a => a.name),
                    creator: todo.creator?.name,
                  });
                }
              }
            }
          } catch { /* skip inaccessible todosets */ }
        }
      }
      results.sort((a, b) => {
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return a.due.localeCompare(b.due);
      });
      setBasecampTodos(results);
      setBasecampLastSync(new Date());
    } catch (e) {
      setBasecampError('Nelze se připojit k Basecamp proxy. Spusť: node basecamp-proxy.js');
    } finally {
      setBasecampLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBasecampTodos();
  }, [fetchBasecampTodos]);

  // Basecamp: vytvoření todolists pro kampaň v MKT projektu
  const createBasecampTodolistForCampaign = async (campaign) => {
    try {
      // Get todoset ID for MKT project
      const proj = await bcFetch(`/projects/${MKT_PROJECT_ID}.json`);
      const todosetDock = proj.dock?.find(d => d.name === 'todoset' && d.enabled);
      if (!todosetDock) return null;
      const tsPath = todosetDock.url.replace(/^https:\/\/3\.basecampapi\.com\/3317373/, '');
      const todoset = await bcFetch(tsPath);
      const tlsPath = todoset.todolists_url.replace(/^https:\/\/3\.basecampapi\.com\/3317373/, '');

      const newList = await bcFetch(tlsPath, {
        method: 'POST',
        body: JSON.stringify({
          name: campaign.name,
          description: `Kampaň: ${campaign.dateFrom} – ${campaign.dateTo} | Kanály: ${campaign.channels.join(', ')} | Země: ${campaign.countries.join(', ')}${campaign.description ? '\n\n' + campaign.description : ''}`,
        }),
      });

      // Create default todos in the new list
      const todosPath = newList.todos_url.replace(/^https:\/\/3\.basecampapi\.com\/3317373/, '');
      const defaultTodos = [
        { content: 'Příprava zadání kampaně', due_on: campaign.dateFrom },
        { content: 'Schválení materiálů', due_on: campaign.dateFrom },
        { content: 'Spuštění kampaně', due_on: campaign.dateFrom },
        { content: 'Vyhodnocení výsledků', due_on: campaign.dateTo },
      ];
      for (const todo of defaultTodos) {
        await bcFetch(todosPath, {
          method: 'POST',
          body: JSON.stringify({ ...todo, assignee_ids: [TEREZA_PERSON_ID] }),
        });
      }
      return newList.app_url;
    } catch (e) {
      console.warn('Basecamp todo vytvoření selhalo:', e.message);
      return null;
    }
  };

  // Export do CSV
  const exportToCSV = () => {
    const headers = ['Název', 'Status', 'Datum od', 'Datum do', 'Kanály', 'Země', 'Popis'];
    const rows = campaigns.map(campaign => [
      campaign.name,
      statuses[campaign.status].label,
      campaign.dateFrom,
      campaign.dateTo,
      campaign.channels.join('; '),
      campaign.countries.join('; '),
      campaign.description || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kampane_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Export do Excel (JSON formát pro jednoduchost)
  const exportToExcel = () => {
    const dataStr = JSON.stringify(campaigns, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kampane_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  // Import funkcionalita
  const handleImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          let importedData;
          if (file.name.endsWith('.csv')) {
            // Jednoduchý CSV parser
            const lines = e.target.result.split('\n');
            const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
            importedData = lines.slice(1).filter(line => line.trim()).map((line, index) => {
              const values = line.split(',').map(v => v.replace(/"/g, ''));
              return {
                id: Date.now() + index,
                name: values[0] || '',
                status: Object.keys(statuses).find(key => statuses[key].label === values[1]) || 'priprava',
                dateFrom: values[2] || '',
                dateTo: values[3] || '',
                channels: values[4] ? values[4].split('; ') : [],
                countries: values[5] ? values[5].split('; ') : ['CZ'],
                description: values[6] || '',
                colorIndex: Math.floor(Math.random() * campaignColors.length)
              };
            });
          } else {
            // JSON import
            importedData = JSON.parse(e.target.result);
            importedData = importedData.map(c => ({ ...c, id: Date.now() + Math.random() }));
          }
          setCampaigns(prev => [...prev, ...importedData]);
        } catch (error) {
          alert('Chyba při importu souboru: ' + error.message);
        }
      };
      reader.readAsText(file);
    }
  };

  // Drag & Drop funkcionalita
  const handleDragStart = (e, campaign) => {
    setDraggedCampaign(campaign);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, channel, date) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOver({ channel, date: date.toISOString().split('T')[0] });
  };

  const handleDragLeave = () => {
    setDraggedOver(null);
  };

  const handleDrop = (e, channel, date) => {
    e.preventDefault();
    if (draggedCampaign) {
      const dateStr = date.toISOString().split('T')[0];
      const daysDiff = Math.ceil((new Date(draggedCampaign.dateTo) - new Date(draggedCampaign.dateFrom)) / (1000 * 60 * 60 * 24));
      const newEndDate = new Date(dateStr);
      newEndDate.setDate(newEndDate.getDate() + daysDiff);

      setCampaigns(prev => prev.map(c => 
        c.id === draggedCampaign.id 
          ? { 
              ...c, 
              dateFrom: dateStr,
              dateTo: newEndDate.toISOString().split('T')[0],
              channels: c.channels.includes(channel) ? c.channels : [...c.channels, channel]
            }
          : c
      ));
    }
    setDraggedCampaign(null);
    setDraggedOver(null);
  };

  const updateExpiredCampaigns = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setCampaigns(prev => prev.map(campaign => {
      const endDate = new Date(campaign.dateTo);
      endDate.setHours(0, 0, 0, 0);
      if (endDate < today && campaign.status !== 'ukoncena') {
        return { ...campaign, status: 'ukoncena' };
      }
      return campaign;
    }));
  };

  useEffect(() => {
    updateExpiredCampaigns();
  }, [currentMonth, campaigns.length]);

  const getMonthWeeks = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstMonday = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    firstMonday.setDate(firstDay.getDate() + mondayOffset);
    
    const weeks = [];
    let currentWeekStart = new Date(firstMonday);
    while (currentWeekStart <= lastDay) {
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(currentWeekStart);
        day.setDate(currentWeekStart.getDate() + i);
        weekDays.push(day);
      }
      weeks.push(weekDays);
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }
    return weeks;
  };

  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  
  const handleChannelChange = (channel) => {
    setFormData(prev => ({
      ...prev,
      channels: prev.channels.includes(channel) 
        ? prev.channels.filter(c => c !== channel)
        : [...prev.channels, channel]
    }));
  };

  const handleCountryChange = (country) => {
    setFormData(prev => ({
      ...prev,
      countries: prev.countries.includes(country)
        ? prev.countries.filter(c => c !== country)
        : [...prev.countries, country]
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.dateFrom || !formData.dateTo || formData.channels.length === 0) return;

    if (editingCampaign) {
      setCampaigns(prev => prev.map(c =>
        c.id === editingCampaign.id ? { ...formData, id: editingCampaign.id, colorIndex: editingCampaign.colorIndex } : c
      ));
    } else {
      const newCampaign = {
        ...formData,
        id: Date.now(),
        colorIndex: campaigns.length % campaignColors.length
      };
      // Pokud není Basecamp URL, vytvoř todolist automaticky
      if (!newCampaign.basecampUrl) {
        const bcUrl = await createBasecampTodolistForCampaign(newCampaign);
        if (bcUrl) newCampaign.basecampUrl = bcUrl;
      }
      setCampaigns(prev => [...prev, newCampaign]);
      setTimeout(fetchBasecampTodos, 2000); // refresh todos po vytvoření
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '', dateFrom: '', dateTo: '', channels: [], status: 'priprava',
      countries: ['CZ'], description: '', productTableUrl: '', basecampUrl: ''
    });
    setShowModal(false);
    setEditingCampaign(null);
  };

  const handleEdit = (campaign) => {
    setFormData(campaign);
    setEditingCampaign(campaign);
    setShowModal(true);
  };

  const handleDelete = (campaignId) => setCampaigns(prev => prev.filter(c => c.id !== campaignId));
  const isCurrentMonth = (date) => date.getMonth() === currentMonth.getMonth();

  const addCampaignToCell = (channel, date) => {
    const dateString = date.toISOString().split('T')[0];
    setFormData({
      name: '', dateFrom: dateString, dateTo: dateString, channels: [channel],
      status: 'priprava', countries: ['CZ'], description: '', productTableUrl: '', basecampUrl: ''
    });
    setShowModal(true);
  };

  // Filtrované kampaně
  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filters.status === 'all' || campaign.status === filters.status;
    const matchesCountry = filters.country === 'all' || campaign.countries.includes(filters.country);
    const matchesChannel = filters.channel === 'all' || campaign.channels.includes(filters.channel);
    
    return matchesSearch && matchesStatus && matchesCountry && matchesChannel;
  });

  // Kampaně v aktuálním měsíci
  const monthCampaigns = filteredCampaigns.filter(campaign => {
    const startDate = new Date(campaign.dateFrom);
    const endDate = new Date(campaign.dateTo);
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    return (startDate <= monthEnd && endDate >= monthStart);
  });

  // Analytická data
  const getAnalytics = () => {
    const statusCounts = Object.keys(statuses).reduce((acc, status) => {
      acc[status] = filteredCampaigns.filter(c => c.status === status).length;
      return acc;
    }, {});

    const channelCounts = channels.reduce((acc, channel) => {
      acc[channel] = filteredCampaigns.filter(c => c.channels.includes(channel)).length;
      return acc;
    }, {});

    return { statusCounts, channelCounts };
  };

  const monthWeeks = getMonthWeeks(currentMonth);
  const analytics = getAnalytics();

  const renderTodosView = () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const overdue = basecampTodos.filter(t => !t.completed && t.due && t.due < today);
    const dueToday = basecampTodos.filter(t => !t.completed && t.due === today);
    const dueTomorrow = basecampTodos.filter(t => !t.completed && t.due === tomorrow);
    const dueThisWeek = basecampTodos.filter(t => !t.completed && t.due && t.due > tomorrow && t.due <= nextWeek);
    const later = basecampTodos.filter(t => !t.completed && (!t.due || t.due > nextWeek));

    const TodoItem = ({ todo }) => (
      <div className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 group">
        <div className="mt-0.5 w-4 h-4 rounded border-2 border-gray-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm text-gray-800 leading-snug">{todo.content}</span>
            <a href={todo.url} target="_blank" rel="noreferrer" className="opacity-0 group-hover:opacity-100 flex-shrink-0">
              <ExternalLink className="w-3.5 h-3.5 text-gray-400 hover:text-purple-500" />
            </a>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400 truncate">{todo.project.replace(/^\[.*?\]\s*/, '')} / {todo.list}</span>
            {todo.due && <span className="text-xs text-gray-400">· {new Date(todo.due + 'T00:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}</span>}
          </div>
        </div>
      </div>
    );

    const Section = ({ title, items, color, emptyText }) => (
      <div className="mb-6">
        <div className={`flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg ${color}`}>
          <span className="font-semibold text-sm">{title}</span>
          <span className="ml-auto text-xs font-bold">{items.length}</span>
        </div>
        {items.length === 0
          ? <p className="text-xs text-gray-400 px-3">{emptyText}</p>
          : items.map(t => <TodoItem key={t.id} todo={t} />)
        }
      </div>
    );

    return (
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-purple-600">Moje úkoly v Basecamp</h3>
            {basecampLastSync && (
              <p className="text-xs text-gray-400 mt-0.5">
                Aktualizováno: {basecampLastSync.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <button
            onClick={fetchBasecampTodos}
            disabled={basecampLoading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${basecampLoading ? 'animate-spin' : ''}`} />
            {basecampLoading ? 'Načítám…' : 'Aktualizovat'}
          </button>
        </div>

        {basecampError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <strong>Chyba připojení:</strong> {basecampError}
            <div className="mt-2 font-mono text-xs bg-red-100 rounded p-2">node basecamp-proxy.js</div>
          </div>
        )}

        {basecampLoading && basecampTodos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <RefreshCw className="w-10 h-10 mx-auto mb-3 animate-spin opacity-50" />
            <p>Načítám todos z Basecampu…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <Section title="Prošlé termíny" items={overdue} color="bg-red-50 text-red-700" emptyText="Nic prošlého" />
              <Section title="Dnes" items={dueToday} color="bg-orange-50 text-orange-700" emptyText="Na dnešek nemáš nic naplánováno" />
              <Section title="Zítra" items={dueTomorrow} color="bg-yellow-50 text-yellow-700" emptyText="Zítra nic" />
              <Section title="Tento týden" items={dueThisWeek} color="bg-blue-50 text-blue-700" emptyText="Tento týden nic dalšího" />
            </div>
            <div>
              <Section title="Později / bez termínu" items={later} color="bg-gray-50 text-gray-600" emptyText="Žádné další úkoly" />
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>Celkem otevřených: {basecampTodos.filter(t => !t.completed).length}</span>
          <span>Prošlé: {overdue.length} · Dnes: {dueToday.length} · Tento týden: {dueThisWeek.length}</span>
        </div>
      </div>
    );
  };

  // Timeline view rendering
  const renderTimelineView = () => {
    const sortedCampaigns = [...monthCampaigns].sort((a, b) => new Date(a.dateFrom) - new Date(b.dateFrom));
    
    return (
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <h3 className="text-xl font-bold mb-6 text-purple-600">Timeline kampaní - {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
        <div className="space-y-6">
          {sortedCampaigns.map((campaign, index) => {
            const StatusIcon = statuses[campaign.status].icon;
            const startDate = new Date(campaign.dateFrom);
            const endDate = new Date(campaign.dateTo);
            const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            
            return (
              <div key={campaign.id} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${statuses[campaign.status].color}`}>
                    <StatusIcon className="w-4 h-4" />
                  </div>
                  {index < sortedCampaigns.length - 1 && <div className="w-0.5 h-16 bg-gray-200 mt-2"></div>}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-gray-900">{campaign.name}</h4>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        <span>{startDate.toLocaleDateString('cs-CZ')} - {endDate.toLocaleDateString('cs-CZ')}</span>
                        <span>({duration} {duration === 1 ? 'den' : duration < 5 ? 'dny' : 'dní'})</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statuses[campaign.status].color}`}>
                          {statuses[campaign.status].label}
                        </span>
                      </div>
                      
                      <div className="mt-2 flex flex-wrap gap-2">
                        {campaign.channels.slice(0, 3).map(channel => (
                          <span key={channel} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                            {channel}
                          </span>
                        ))}
                        {campaign.channels.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                            +{campaign.channels.length - 3} dalších
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-2 flex gap-1">
                        {campaign.countries.map(country => (
                          <span key={country} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-mono">
                            {country}
                          </span>
                        ))}
                      </div>
                      
                      {campaign.description && (
                        <p className="mt-2 text-sm text-gray-600">{campaign.description}</p>
                      )}
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <button onClick={() => handleEdit(campaign)} className="p-2 hover:bg-purple-100 rounded transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(campaign.id)} className="p-2 hover:bg-red-100 rounded transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {sortedCampaigns.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Žádné kampaně v tomto měsíci</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Calendar view rendering
  const renderCalendarView = () => (
    <div className="border-2 border-purple-200 rounded-2xl bg-white shadow-xl overflow-hidden">
      {monthWeeks.map((weekDays, weekIndex) => (
        <div key={weekIndex}>
          <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white border-b-2 border-purple-300">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{width: '200px'}} />
                <col style={{width: '140px'}} />
                <col style={{width: '140px'}} />
                <col style={{width: '140px'}} />
                <col style={{width: '140px'}} />
                <col style={{width: '140px'}} />
                <col style={{width: '140px'}} />
                <col style={{width: '140px'}} />
              </colgroup>
              <thead>
                <tr>
                  <th className="p-4 font-bold border-r-2 border-purple-300 text-center">
                    {weekIndex === 0 ? 'Kanál' : `Týden ${weekIndex + 1}`}
                  </th>
                  {weekDays.map((date, dayIndex) => (
                    <th key={dayIndex} className={`p-4 text-center font-bold border-r-2 border-purple-300 last:border-r-0 ${!isCurrentMonth(date) ? 'bg-purple-400 opacity-60' : ''}`}>
                      <div className="text-base font-bold">
                        {weekIndex === 0 ? dayNames[dayIndex] : ''}
                      </div>
                      <div className="text-sm mt-1 font-semibold">
                        {date.getDate()}.{date.getMonth() + 1}.{date.getFullYear()}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>

          <table className="w-full table-fixed">
            <colgroup>
              <col style={{width: '200px'}} />
              <col style={{width: '140px'}} />
              <col style={{width: '140px'}} />
              <col style={{width: '140px'}} />
              <col style={{width: '140px'}} />
              <col style={{width: '140px'}} />
              <col style={{width: '140px'}} />
              <col style={{width: '140px'}} />
            </colgroup>
            <tbody>
              {channels.map((channel, channelIndex) => (
                <tr key={`${weekIndex}-${channel}`} className={`border-b border-purple-100 ${channelIndex % 2 === 0 ? 'bg-gradient-to-r from-pink-25 to-purple-25' : 'bg-white'}`}>
                  <td className="p-4 font-semibold text-gray-800 border-r border-purple-200 bg-gradient-to-r from-pink-50 to-purple-50 text-base align-top">
                    {channel}
                  </td>
                  {weekDays.map((date, dayIndex) => {
                    const campaignsInCell = filteredCampaigns.filter(campaign => {
                      if (!campaign.channels.includes(channel)) return false;
                      const dateStr = date.toISOString().split('T')[0];
                      const fromDate = new Date(campaign.dateFrom);
                      const toDate = new Date(campaign.dateTo);
                      const checkDate = new Date(dateStr);
                      return checkDate >= fromDate && checkDate <= toDate;
                    });
                    
                    const isDraggedOver = draggedOver && 
                      draggedOver.channel === channel && 
                      draggedOver.date === date.toISOString().split('T')[0];
                    
                    return (
                      <td 
                        key={dayIndex} 
                        className={`border-r border-purple-200 last:border-r-0 p-2 align-top ${!isCurrentMonth(date) ? 'bg-gray-50' : ''} ${isDraggedOver ? 'bg-purple-100 border-purple-400' : ''}`} 
                        style={{minHeight: '80px'}}
                        onDragOver={(e) => handleDragOver(e, channel, date)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, channel, date)}
                      >
                        <div className="min-h-[80px] flex flex-col">
                          <div className="mb-2">
                            <button onClick={() => addCampaignToCell(channel, date)} className="w-full bg-transparent hover:bg-gray-100 text-gray-300 hover:text-gray-500 text-lg font-light py-1 px-2 rounded border border-gray-200 hover:border-gray-300 transition-all" title={`Přidat kampaň do ${channel} na ${date.toLocaleDateString('cs-CZ')}`}>
                              +
                            </button>
                          </div>
                          
                          <div className="flex-1 space-y-1">
                            {campaignsInCell.map((campaign) => (
                              <div 
                                key={campaign.id} 
                                className={`w-full rounded border-2 text-xs px-2 py-1 cursor-move hover:opacity-90 transition-all ${campaignColors[campaign.colorIndex]} font-semibold`} 
                                onClick={() => handleEdit(campaign)} 
                                title={campaign.name}
                                draggable
                                onDragStart={(e) => handleDragStart(e, campaign)}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="truncate flex-1">{campaign.name}</span>
                                  <div className="flex gap-1 ml-1">
                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(campaign); }} className="p-1 hover:bg-white hover:bg-opacity-30 rounded">
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(campaign.id); }} className="p-1 hover:bg-white hover:bg-opacity-30 rounded">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );

  // List view rendering
  const renderListView = () => (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-purple-200">
              <th className="text-left p-4 font-bold">Název</th>
              <th className="text-left p-4 font-bold">Status</th>
              <th className="text-left p-4 font-bold">Datum</th>
              <th className="text-left p-4 font-bold">Kanály</th>
              <th className="text-left p-4 font-bold">Země</th>
              <th className="text-left p-4 font-bold">Akce</th>
            </tr>
          </thead>
          <tbody>
            {filteredCampaigns.map((campaign, index) => (
              <tr key={campaign.id} className={`border-b border-purple-100 hover:bg-purple-25 ${index % 2 === 0 ? 'bg-purple-25' : 'bg-white'}`}>
                <td className="p-4 font-semibold">{campaign.name}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${statuses[campaign.status].color}`}>
                    {React.createElement(statuses[campaign.status].icon, { className: "w-3 h-3" })}
                    {statuses[campaign.status].label}
                  </span>
                </td>
                <td className="p-4 text-sm">
                  {new Date(campaign.dateFrom).toLocaleDateString('cs-CZ')} - {new Date(campaign.dateTo).toLocaleDateString('cs-CZ')}
                </td>
                <td className="p-4 text-sm">
                  <div className="flex flex-wrap gap-1">
                    {campaign.channels.slice(0, 2).map(channel => (
                      <span key={channel} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                        {channel}
                      </span>
                    ))}
                    {campaign.channels.length > 2 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        +{campaign.channels.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4 text-sm">
                  <div className="flex gap-1">
                    {campaign.countries.map(country => (
                      <span key={country} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-mono">
                        {country}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(campaign)} className="p-2 hover:bg-purple-100 rounded transition-colors" title="Upravit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(campaign.id)} className="p-2 hover:bg-red-100 rounded transition-colors" title="Smazat">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredCampaigns.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Žádné kampaně nenalezeny</p>
          </div>
        )}
      </div>
    </div>
  );

  // Analytics view rendering
  const renderAnalyticsView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <h3 className="text-xl font-bold mb-4 text-purple-600">Kampaně podle statusu</h3>
        <div className="space-y-3">
          {Object.entries(analytics.statusCounts).map(([status, count]) => {
            const StatusIcon = statuses[status].icon;
            return (
              <div key={status} className="flex items-center justify-between">
                <span className={`px-3 py-2 rounded-full text-sm font-semibold flex items-center gap-2 ${statuses[status].color}`}>
                  <StatusIcon className="w-4 h-4" />
                  {statuses[status].label}
                </span>
                <span className="text-2xl font-bold">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6">
        <h3 className="text-xl font-bold mb-4 text-purple-600">Nejpoužívanější kanály</h3>
        <div className="space-y-2">
          {Object.entries(analytics.channelCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 8)
            .map(([channel, count]) => (
            <div key={channel} className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm font-medium">{channel}</span>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-gray-200 rounded-full h-2">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500" style={{width: `${Math.min(Math.max(count * 25, 5), 100)}%`}}></div>
                </div>
                <span className="text-sm font-bold w-8 text-right">{count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6 lg:col-span-2">
        <h3 className="text-xl font-bold mb-4 text-purple-600">Přehled statistik</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
            <div className="text-3xl font-bold text-purple-600 mb-2">{campaigns.length}</div>
            <div className="text-sm text-gray-600 font-medium">Celkem kampaní</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl">
            <div className="text-3xl font-bold text-green-600 mb-2">{analytics.statusCounts.aktivni || 0}</div>
            <div className="text-sm text-gray-600 font-medium">Aktivní kampaně</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl">
            <div className="text-3xl font-bold text-blue-600 mb-2">{analytics.statusCounts.kespusteni || 0}</div>
            <div className="text-sm text-gray-600 font-medium">Ke spuštění</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl">
            <div className="text-3xl font-bold text-yellow-600 mb-2">{analytics.statusCounts.priprava || 0}</div>
            <div className="text-sm text-gray-600 font-medium">V přípravě</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl">
            <div className="text-2xl font-bold text-indigo-600 mb-2">{monthCampaigns.length}</div>
            <div className="text-sm text-gray-600 font-medium">Kampaní tento měsíc</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl">
            <div className="text-2xl font-bold text-pink-600 mb-2">
              {new Set(campaigns.flatMap(c => c.channels)).size}
            </div>
            <div className="text-sm text-gray-600 font-medium">Používaných kanálů</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl">
            <div className="text-2xl font-bold text-teal-600 mb-2">
              {new Set(campaigns.flatMap(c => c.countries)).size}
            </div>
            <div className="text-sm text-gray-600 font-medium">Cílových zemí</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-full mx-auto p-6 bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 min-h-screen font-sans overflow-x-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 bg-white shadow-lg rounded-2xl p-4">
        <div className="text-left">
          <h1 className="text-2xl font-bold text-pink-600 font-extrabold">Růžový Slon</h1>
          <p className="text-gray-600 font-medium">Měsíční plán kampaní</p>
        </div>
        
        {/* Notifikace */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-3 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <Bell className="w-6 h-6" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {notifications.length}
              </span>
            )}
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border z-50">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Oznámení</h3>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-gray-500 text-center">
                    Žádná oznámení
                  </div>
                ) : (
                  notifications.map(notification => (
                    <div key={notification.id} className={`p-4 border-b hover:bg-gray-50 ${
                      notification.type === 'error' ? 'border-l-4 border-red-500' :
                      notification.type === 'warning' ? 'border-l-4 border-yellow-500' :
                      'border-l-4 border-blue-500'
                    }`}>
                      <div className="font-medium text-sm">{notification.title}</div>
                      <div className="text-xs text-gray-600 mt-1">{notification.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-6 bg-white shadow-lg rounded-2xl p-6 border border-purple-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Navigace měsíce */}
          <div className="flex items-center gap-4">
            <button onClick={handlePrevMonth} className="p-3 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 rounded-xl transition-colors flex items-center gap-2 text-gray-700 font-medium">
              <ChevronLeft className="w-6 h-6" />
              Předchozí
            </button>
            
            <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 bg-clip-text text-transparent whitespace-nowrap">
              {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h2>
            
            <button onClick={handleNextMonth} className="p-3 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 rounded-xl transition-colors flex items-center gap-2 text-gray-700 font-medium">
              Další
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 min-w-64">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Hledat kampaně..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          {/* View modes */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'calendar' ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100'}`}
              title="Kalendářový pohled"
            >
              <Calendar className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'timeline' ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100'}`}
              title="Timeline pohled"
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100'}`}
              title="Seznam kampaní"
            >
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('analytics')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'analytics' ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100'}`}
              title="Analytiky"
            >
              <BarChart3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('todos')}
              className={`relative p-2 rounded-lg transition-colors ${viewMode === 'todos' ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100'}`}
              title="Moje Basecamp úkoly"
            >
              <Briefcase className="w-5 h-5" />
              {basecampTodos.filter(t => !t.completed && t.due && t.due <= new Date().toISOString().split('T')[0]).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {basecampTodos.filter(t => !t.completed && t.due && t.due <= new Date().toISOString().split('T')[0]).length}
                </span>
              )}
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={() => setShowModal(true)} className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white px-4 py-2 rounded-xl hover:from-pink-600 hover:via-purple-600 hover:to-blue-600 transition-all flex items-center gap-2 font-medium shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />
              Nová
            </button>
            <div className="relative">
              <button className="p-2 border rounded-lg hover:bg-gray-50 transition-colors" title="Export">
                <Download className="w-5 h-5" />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border hidden group-hover:block">
                <button onClick={exportToCSV} className="block w-full text-left px-4 py-2 hover:bg-gray-50">CSV</button>
                <button onClick={exportToExcel} className="block w-full text-left px-4 py-2 hover:bg-gray-50">JSON</button>
              </div>
            </div>
            <label className="p-2 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer" title="Import dat">
              <Upload className="w-5 h-5" />
              <input type="file" accept=".json,.csv" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>

        {/* Filtry */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filtry:</span>
          </div>
          
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="px-3 py-1 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="all">Všechny statusy</option>
            {Object.entries(statuses).map(([key, status]) => (
              <option key={key} value={key}>{status.label}</option>
            ))}
          </select>
          
          <select
            value={filters.country}
            onChange={(e) => setFilters(prev => ({ ...prev, country: e.target.value }))}
            className="px-3 py-1 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="all">Všechny země</option>
            {countries.map(country => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
          
          <select
            value={filters.channel}
            onChange={(e) => setFilters(prev => ({ ...prev, channel: e.target.value }))}
            className="px-3 py-1 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="all">Všechny kanály</option>
            {channels.map(channel => (
              <option key={channel} value={channel}>{channel}</option>
            ))}
          </select>

          {(searchTerm || filters.status !== 'all' || filters.country !== 'all' || filters.channel !== 'all') && (
            <button 
              onClick={() => {
                setSearchTerm('');
                setFilters({ status: 'all', country: 'all', channel: 'all' });
              }}
              className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors"
            >
              Vymazat filtry
            </button>
          )}
        </div>
      </div>

      {/* Přehled kampaní v měsíci */}
      {viewMode === 'calendar' && (
        <div className="mb-6 bg-white shadow-lg rounded-2xl p-6 border border-purple-100">
          <h3 className="text-lg font-bold text-purple-600 mb-4">
            Kampaně v měsíci {months[currentMonth.getMonth()]} ({monthCampaigns.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {monthCampaigns.slice(0, 8).map(campaign => {
              const StatusIcon = statuses[campaign.status].icon;
              return (
                <div key={campaign.id} className={`p-4 rounded-lg border-2 cursor-pointer hover:shadow-md transition-all ${campaignColors[campaign.colorIndex]}`} onClick={() => handleEdit(campaign)}>
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-sm truncate flex-1">{campaign.name}</h4>
                    <StatusIcon className="w-4 h-4 ml-2 flex-shrink-0" />
                  </div>
                  <div className="text-xs opacity-75 flex items-center gap-2">
                    <span>{new Date(campaign.dateFrom).toLocaleDateString('cs-CZ')} - {new Date(campaign.dateTo).toLocaleDateString('cs-CZ')}</span>
                    {campaign.basecampUrl && (
                      <a href={campaign.basecampUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} title="Otevřít v Basecamp">
                        <ExternalLink className="w-3 h-3 opacity-70 hover:opacity-100" />
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {campaign.channels.slice(0, 2).map(channel => (
                      <span key={channel} className="px-1 py-0.5 bg-white bg-opacity-30 rounded text-xs truncate">
                        {channel}
                      </span>
                    ))}
                    {campaign.channels.length > 2 && (
                      <span className="px-1 py-0.5 bg-white bg-opacity-30 rounded text-xs">
                        +{campaign.channels.length - 2}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {monthCampaigns.length > 8 && (
              <div className="p-4 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-500">
                <span className="text-sm">+{monthCampaigns.length - 8} dalších kampaní</span>
              </div>
            )}
            {monthCampaigns.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Žádné kampaně v tomto měsíci</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="mb-6">
        {viewMode === 'calendar' && renderCalendarView()}
        {viewMode === 'timeline' && renderTimelineView()}
        {viewMode === 'list' && renderListView()}
        {viewMode === 'analytics' && renderAnalyticsView()}
        {viewMode === 'todos' && renderTodosView()}
      </div>

      {/* Modal pro vytváření/editaci kampaní */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex-shrink-0">
              <h3 className="text-xl font-semibold">
                {editingCampaign ? 'Upravit kampaň' : 'Nová kampaň'}
              </h3>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Název kampaně *</label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))} 
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" 
                    placeholder="Název vaší kampaně"
                    required 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Datum od *</label>
                    <input 
                      type="date" 
                      value={formData.dateFrom} 
                      onChange={(e) => setFormData(prev => ({...prev, dateFrom: e.target.value}))} 
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" 
                      required 
                    />
                  </div>
                  <div>  
                    <label className="block text-sm font-medium mb-2">Datum do *</label>
                    <input 
                      type="date" 
                      value={formData.dateTo} 
                      onChange={(e) => setFormData(prev => ({...prev, dateTo: e.target.value}))} 
                      min={formData.dateFrom} 
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" 
                      required 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Stav kampaně</label>
                    <select 
                      value={formData.status} 
                      onChange={(e) => setFormData(prev => ({...prev, status: e.target.value}))} 
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                      {Object.entries(statuses).map(([key, status]) => (
                        <option key={key} value={key}>{status.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Země</label>
                    <div className="grid grid-cols-4 gap-2 p-3 border rounded-lg bg-gray-50 max-h-24 overflow-y-auto">
                      {countries.map(country => (
                        <label key={country} className="flex items-center space-x-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={formData.countries.includes(country)} 
                            onChange={() => handleCountryChange(country)} 
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" 
                          />
                          <span className="text-sm font-mono">{country}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Kanály *</label>
                  <div className="border rounded-lg p-4 bg-gray-50 max-h-60 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-2">
                      {channels.map((channel, index) => (
                        <div key={channel} className={`p-2 rounded ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                          <label className="flex items-center space-x-3 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={formData.channels.includes(channel)} 
                              onChange={() => handleChannelChange(channel)} 
                              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" 
                            />
                            <span className="text-sm font-medium">{channel}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  {formData.channels.length === 0 && (
                    <p className="text-sm text-red-600 mt-1">Vyberte alespoň jeden kanál</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Popis/Podrobnosti</label>
                  <textarea 
                    value={formData.description} 
                    onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))} 
                    rows={3} 
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" 
                    placeholder="Detaily kampaně, cíle, poznámky..." 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Odkaz na tabulku s produkty</label>
                    <input 
                      type="url" 
                      value={formData.productTableUrl} 
                      onChange={(e) => setFormData(prev => ({...prev, productTableUrl: e.target.value}))} 
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" 
                      placeholder="https://..." 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Odkaz na Basecamp zadání</label>
                    <input 
                      type="url" 
                      value={formData.basecampUrl} 
                      onChange={(e) => setFormData(prev => ({...prev, basecampUrl: e.target.value}))} 
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" 
                      placeholder="https://basecamp.com/..." 
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex-shrink-0">
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={resetForm} 
                  className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Zrušit
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    if (!formData.name || !formData.dateFrom || !formData.dateTo || formData.channels.length === 0) return;
                    handleSubmit();
                  }} 
                  className="px-6 py-2 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white rounded-lg hover:from-pink-600 hover:via-purple-600 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed" 
                  disabled={!formData.name || !formData.dateFrom || !formData.dateTo || formData.channels.length === 0}
                >
                  {editingCampaign ? 'Uložit změny' : 'Vytvořit kampaň'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignCalendar;
                    
      