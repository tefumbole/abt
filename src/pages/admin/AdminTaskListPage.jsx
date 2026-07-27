import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { getTasks, deleteTask, resendTaskNotification, checkAndUpdateOverdueTasks } from '@/services/taskService';
import { getTaskCategories } from '@/services/taskCategoryService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Edit, Trash2, Send, FilterX } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import EditTaskModal from '@/components/admin/EditTaskModal';
import { getPriorityColor, getStatusColor } from '@/components/admin/TaskDashboardCard';
import { getEffectiveTaskStatus } from '@/utils/taskDeadline';
import { COLORED_TAB_BASE, getTabTheme } from '@/components/admin/tabTheme';
import { cn } from '@/lib/utils';

const TASK_TABS = [
  { id: 'uncompleted', label: 'Uncompleted Tasks', color: 'orange' },
  { id: 'completed', label: 'Completed Tasks', color: 'green' },
  { id: 'overdue', label: 'Overdue', color: 'rose' },
];

const tabForTask = (task) => {
  const status = getEffectiveTaskStatus(task);
  if (status === 'Completed') return 'completed';
  if (status === 'Overdue') return 'overdue';
  return 'uncompleted';
};

const AdminTaskListPage = () => {
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({ status: 'All', priority: 'All', category: 'All' });
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'uncompleted');
  const [remindingId, setRemindingId] = useState(null);

  const [editTask, setEditTask] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    const status = searchParams.get('status');
    if (tab && TASK_TABS.some((t) => t.id === tab)) setActiveTab(tab);
    if (status) setFilters((prev) => ({ ...prev, status }));
  }, [searchParams]);

  useEffect(() => {
    loadTasks();
  }, [filters]);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab]);

  const loadCategories = async () => {
    const res = await getTaskCategories();
    if (res.success) setCategories(res.data);
  };

  const loadTasks = async () => {
    setLoading(true);
    await checkAndUpdateOverdueTasks();
    const res = await getTasks(filters);
    if (res.success) {
      setTasks(res.data);
    } else {
      toast({ title: "Error loading tasks", description: res.error, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    const res = await deleteTask(id);
    if (res.success) {
      toast({ title: "Task deleted successfully" });
      loadTasks();
    } else {
      toast({ title: "Error deleting task", description: res.error, variant: "destructive" });
    }
  };

  const handleResendNotification = async (taskId, assigneeId, assigneeName) => {
    setRemindingId(`${taskId}:${assigneeId}`);
    const res = await resendTaskNotification(taskId, assigneeId);
    setRemindingId(null);
    if (res.success) {
      toast({ title: 'Reminder sent', description: `${assigneeName || 'Assignee'} has been reminded of this task and its deadline.` });
    } else {
      toast({ title: "Failed to send reminder", description: res.error, variant: "destructive" });
    }
  };

  const openEditModal = (task) => {
    setEditTask(task);
    setIsEditModalOpen(true);
  };

  const toggleSelection = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected task(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    let ok = 0;
    for (const id of selectedIds) {
      // eslint-disable-next-line no-await-in-loop
      const res = await deleteTask(id);
      if (res.success) ok += 1;
    }
    setBulkDeleting(false);
    toast({ title: 'Tasks deleted', description: `${ok} task(s) removed.` });
    setSelectedIds([]);
    loadTasks();
  };

  const visibleTasks = tasks.filter(task => tabForTask(task) === activeTab);
  const allVisibleSelected = visibleTasks.length > 0 && visibleTasks.every((t) => selectedIds.includes(t.id));
  const toggleSelectAllVisible = (checked) => {
    const visibleIds = visibleTasks.map((t) => t.id);
    setSelectedIds((prev) =>
      checked
        ? [...new Set([...prev, ...visibleIds])]
        : prev.filter((id) => !visibleIds.includes(id))
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#003D82]">Task Management</h1>
          <p className="text-gray-500">View and manage all system tasks.</p>
        </div>
        <Link to="/admin/tasks/create">
          <Button className="bg-[#003D82]"><Plus className="w-4 h-4 mr-2" /> Create Task</Button>
        </Link>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-gray-700">Filters:</span>
        <Select value={filters.priority} onValueChange={v => setFilters({...filters, priority: v})}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Priorities</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Emergency">Emergency</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.category} onValueChange={v => setFilters({...filters, category: v})}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button variant="ghost" onClick={() => setFilters({status: 'All', priority: 'All', category: 'All'})}>
          <FilterX className="w-4 h-4 mr-2" /> Clear
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {TASK_TABS.map(tab => {
          const count = tasks.filter(t => tabForTask(t) === tab.id).length;
          const active = activeTab === tab.id;
          const theme = getTabTheme(tab.color);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(COLORED_TAB_BASE, active ? theme.active : theme.idle)}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-white/25 text-white' : 'bg-white/80 text-inherit'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 bg-white p-3 rounded-lg shadow-sm border">
          <span className="text-sm text-gray-600">{selectedIds.length} selected</span>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50"
            disabled={bulkDeleting}
            onClick={handleBulkDelete}
          >
            {bulkDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Delete Selected
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Clear</Button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow border overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-[#003D82]" /></div>
        ) : visibleTasks.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            No {TASK_TABS.find(t => t.id === activeTab)?.label.toLowerCase()} found.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={(c) => toggleSelectAllVisible(Boolean(c))} aria-label="Select all" />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Assignees</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleTasks.map(task => {
                const displayStatus = getEffectiveTaskStatus(task);
                return (
                <TableRow key={task.id} className={selectedIds.includes(task.id) ? 'bg-blue-50/40' : ''}>
                  <TableCell>
                    <Checkbox checked={selectedIds.includes(task.id)} onCheckedChange={() => toggleSelection(task.id)} aria-label="Select task" />
                  </TableCell>
                  <TableCell className="font-medium">{task.title}</TableCell>
                  <TableCell>
                    {task.task_categories ? (
                      <Badge variant="outline" style={{borderColor: task.task_categories.color, color: task.task_categories.color}}>
                        {task.task_categories.name}
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell><Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge></TableCell>
                  <TableCell><Badge className={getStatusColor(displayStatus)}>{displayStatus}</Badge></TableCell>
                  <TableCell>
                    {task.deadline ? (
                      <>
                        {format(new Date(task.deadline), 'MMM dd, yyyy')}
                        {task.deadline_time ? ` ${String(task.deadline_time).slice(0, 5)}` : ''}
                      </>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 min-w-[200px]">
                      {task.task_assignments?.map(a => {
                        const fullName = a.profiles?.full_name || 'Unassigned';
                        const busy = remindingId === `${task.id}:${a.user_id}`;
                        return (
                         <div key={a.id} className="text-xs flex items-center justify-between gap-2 bg-gray-50 px-2 py-1 rounded">
                           <span className="font-medium text-gray-700" title={fullName}>{fullName}</span>
                           <Button
                             variant="ghost"
                             size="sm"
                             className="h-6 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                             title="Send a WhatsApp reminder about this task and its deadline"
                             disabled={busy}
                             onClick={() => handleResendNotification(task.id, a.user_id, fullName)}
                           >
                             {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Send className="h-3 w-3 mr-1" /> Remind</>}
                           </Button>
                         </div>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditModal(task)}>
                      <Edit className="w-4 h-4 text-gray-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(task.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <EditTaskModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        task={editTask}
        onSave={loadTasks}
      />
    </div>
  );
};

export default AdminTaskListPage;