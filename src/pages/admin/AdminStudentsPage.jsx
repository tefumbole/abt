import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getStudents, createStudent, updateStudent, deleteStudent } from '@/services/studentsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Trash2, Edit2, Plus, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const AdminStudentsPage = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', course: '', status: 'Pending' });
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const fetchStudents = async () => {
    setLoading(true);
    const data = await getStudents();
    setStudents(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (searchParams.get('action') !== 'new') return;
    setEditingStudent(null);
    setFormData({ name: '', email: '', phone: '', course: '', status: 'Pending' });
    setModalOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.email) {
      toast({ title: "Error", description: "Name and Email are required.", variant: "destructive" });
      return;
    }

    try {
      if (editingStudent) {
        await updateStudent(editingStudent.id, formData);
        toast({ title: "Success", description: "Student updated." });
      } else {
        await createStudent(formData);
        toast({ title: "Success", description: "Student enrolled." });
      }
      setModalOpen(false);
      fetchStudents();
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    setFormData({ 
        name: student.name, 
        email: student.email, 
        phone: student.phone, 
        course: student.course || '', 
        status: student.status 
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this student record?")) {
      await deleteStudent(id);
      fetchStudents();
      toast({ title: "Deleted", description: "Student record removed." });
    }
  };

  const openNewModal = () => {
    setEditingStudent(null);
    setFormData({ name: '', email: '', phone: '', course: '', status: 'Pending' });
    setModalOpen(true);
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#003D82]">Student Registry</h1>
          <p className="text-gray-500">Manage student enrollments and admissions.</p>
        </div>
        <Button onClick={openNewModal} className="bg-[#D4AF37] text-[#003D82] hover:bg-[#bfa030] font-bold">
          <Plus className="mr-2 h-4 w-4" /> Add Student
        </Button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input 
                placeholder="Search students..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-[#003D82]" /></div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-[#003D82] text-white">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Course/Program</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-gray-500">No students found.</td></tr>
              ) : (
                filteredStudents.map(student => (
                  <tr key={student.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-medium">{student.name}</td>
                    <td className="p-4 text-sm text-gray-600">
                        <div>{student.email}</div>
                        <div>{student.phone}</div>
                    </td>
                    <td className="p-4">{student.course || 'General'}</td>
                    <td className="p-4">
                        <span className={cn(
                            "px-2 py-1 rounded-full text-xs font-bold",
                            student.status === 'Admitted' ? "bg-green-100 text-green-800" :
                            student.status === 'Rejected' ? "bg-red-100 text-red-800" :
                            "bg-yellow-100 text-yellow-800"
                        )}>
                            {student.status}
                        </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(student)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(student.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStudent ? 'Edit Student' : 'Enroll New Student'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
                <label className="text-sm font-medium mb-1 block">Full Name</label>
                <Input name="name" value={formData.name} onChange={handleInputChange} placeholder="Student Name" />
            </div>
            <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <Input name="email" value={formData.email} onChange={handleInputChange} placeholder="student@example.com" />
            </div>
            <div>
                <label className="text-sm font-medium mb-1 block">Phone</label>
                <Input name="phone" value={formData.phone} onChange={handleInputChange} placeholder="+250..." />
            </div>
            <div>
                <label className="text-sm font-medium mb-1 block">Program/Course</label>
                <Input name="course" value={formData.course} onChange={handleInputChange} placeholder="e.g. Masterclass 2024" />
            </div>
            <div>
                <label className="text-sm font-medium mb-1 block">Admission Status</label>
                <Select value={formData.status} onValueChange={(val) => setFormData(prev => ({...prev, status: val}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Admitted">Admitted</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <Button onClick={handleSubmit} className="w-full bg-[#003D82] hover:bg-[#002d62]">
                {editingStudent ? 'Update Student' : 'Enroll Student'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminStudentsPage;