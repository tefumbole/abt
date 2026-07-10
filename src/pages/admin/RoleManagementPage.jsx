import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getAllRoles, getAllPermissions, getRolePermissions, createRole, updateRole, deleteRole, assignPermissionToRole, removePermissionFromRole } from '@/services/rbacService';
import { Trash2, Edit2, Plus, Loader2, Shield, CheckCircle2, XCircle } from 'lucide-react';

export default function RoleManagementPage() {
  const { toast } = useToast();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [rolesData, permissionsData] = await Promise.all([
        getAllRoles(),
        getAllPermissions()
      ]);
      setRoles(rolesData);
      setPermissions(permissionsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRole() {
    try {
      if (!formData.name) {
        toast({
          title: 'Validation Error',
          description: 'Role name is required',
          variant: 'destructive'
        });
        return;
      }

      setIsSubmitting(true);
      await createRole(formData.name, formData.description);

      toast({
        title: 'Success',
        description: 'Role created successfully',
        className: 'bg-green-600 text-white'
      });

      setShowCreateModal(false);
      setFormData({ name: '', description: '' });
      loadData();
    } catch (error) {
      console.error('Role creation error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateRole() {
    try {
      setIsSubmitting(true);
      await updateRole(selectedRole.id, {
        name: formData.name,
        description: formData.description
      });

      toast({
        title: 'Success',
        description: 'Role updated successfully',
        className: 'bg-green-600 text-white'
      });

      setShowEditModal(false);
      loadData();
    } catch (error) {
      console.error('Role update error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteRole() {
    try {
      setIsSubmitting(true);
      await deleteRole(selectedRole.id);

      toast({
        title: 'Success',
        description: 'Role deleted successfully',
        className: 'bg-green-600 text-white'
      });

      setShowDeleteDialog(false);
      loadData();
    } catch (error) {
      console.error('Role deletion error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openEditModal(role) {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || ''
    });

    try {
      const perms = await getRolePermissions(role.id);
      setRolePermissions(perms);
    } catch (error) {
      console.error('Error loading role permissions:', error);
    }

    setShowEditModal(true);
  }

  async function handleAssignPermission(permissionId) {
    try {
      await assignPermissionToRole(selectedRole.id, permissionId);

      toast({
        title: 'Success',
        description: 'Permission assigned successfully'
      });

      const perms = await getRolePermissions(selectedRole.id);
      setRolePermissions(perms);
    } catch (error) {
      console.error('Error assigning permission:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  }

  async function handleRemovePermission(permissionId) {
    try {
      await removePermissionFromRole(selectedRole.id, permissionId);

      toast({
        title: 'Success',
        description: 'Permission removed successfully'
      });

      const perms = await getRolePermissions(selectedRole.id);
      setRolePermissions(perms);
    } catch (error) {
      console.error('Error removing permission:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  }

  // Group permissions by category
  const permissionsByCategory = permissions.reduce((acc, perm) => {
    const category = perm.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(perm);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#003D82] mx-auto mb-4" />
          <p className="text-gray-500">Loading role management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Role Management | Alpha Bridge</title>
        <meta name="description" content="Manage system roles and permissions" />
      </Helmet>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#003D82]">Role Management</h1>
          <p className="text-gray-500">Define roles and assign permissions</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-[#003D82] hover:bg-[#002e63] gap-2">
          <Plus size={20} />
          Create Role
        </Button>
      </div>

      {/* Roles Table */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="font-semibold">Role Name</TableHead>
                  <TableHead className="font-semibold">Description</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map(role => (
                  <TableRow key={role.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-[#003D82]" />
                        {role.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{role.description || 'No description'}</TableCell>
                    <TableCell>
                      <Badge variant={role.is_system ? 'default' : 'secondary'} className={role.is_system ? 'bg-blue-100 text-blue-800 border-blue-200' : ''}>
                        {role.is_system ? 'System' : 'Custom'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(role)}
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        >
                          <Edit2 size={16} />
                        </Button>
                        {!role.is_system && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRole(role);
                              setShowDeleteDialog(true);
                            }}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Role Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>Define a new role with custom permissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name *</Label>
              <Input
                id="role-name"
                placeholder="e.g., content_manager"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                placeholder="Describe the purpose of this role..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleCreateRole} disabled={isSubmitting} className="bg-[#003D82] hover:bg-[#002e63]">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Role'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Role Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role: {selectedRole?.name}</DialogTitle>
            <DialogDescription>Update role details and permissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            {/* Role Details */}
            <div className="space-y-4 border-b pb-6">
              <h3 className="font-semibold text-gray-900">Role Details</h3>
              <div className="space-y-2">
                <Label htmlFor="edit-role-name">Role Name</Label>
                <Input
                  id="edit-role-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={selectedRole?.is_system}
                  className={selectedRole?.is_system ? 'bg-gray-100' : ''}
                />
                {selectedRole?.is_system && (
                  <p className="text-xs text-gray-500">System role names cannot be modified</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role-description">Description</Label>
                <Textarea
                  id="edit-role-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Permissions</h3>
              <p className="text-sm text-gray-500">Select permissions for this role</p>
              
              {Object.entries(permissionsByCategory).map(([category, perms]) => (
                <div key={category} className="space-y-3 border-l-2 border-gray-200 pl-4">
                  <h4 className="text-sm font-medium text-gray-700 capitalize">
                    {category.replace('_', ' ')}
                  </h4>
                  <div className="space-y-2">
                    {perms.map(perm => {
                      const isAssigned = rolePermissions.some(rp => rp.id === perm.id);
                      return (
                        <div key={perm.id} className="flex items-start gap-3 p-2 rounded hover:bg-gray-50">
                          <Checkbox
                            id={`perm-${perm.id}`}
                            checked={isAssigned}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                handleAssignPermission(perm.id);
                              } else {
                                handleRemovePermission(perm.id);
                              }
                            }}
                            className="mt-1"
                          />
                          <Label htmlFor={`perm-${perm.id}`} className="cursor-pointer flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{perm.name}</span>
                              {isAssigned ? (
                                <CheckCircle2 className="w-3 h-3 text-green-600" />
                              ) : (
                                <XCircle className="w-3 h-3 text-gray-300" />
                              )}
                            </div>
                            {perm.description && (
                              <span className="text-sm text-gray-600 block mt-1">{perm.description}</span>
                            )}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleUpdateRole} disabled={isSubmitting} className="bg-[#003D82] hover:bg-[#002e63]">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Role</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the role "{selectedRole?.name}"? This action cannot be undone.
            Users assigned to this role will lose their permissions.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRole} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}