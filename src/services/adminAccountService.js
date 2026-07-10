import { supabase } from '@/lib/customSupabaseClient';
import { getRoleByName, assignRoleToUser } from '@/services/rbacService';
import { sendWhatsAppMessage } from '@/services/wasenderapiService';

/**
 * Admin Account Service
 * Handles user creation, updates, and deletion with RBAC support
 */

/**
 * Format error message with detailed logging
 * @param {Object} error - Error object
 * @returns {string} User-friendly error message
 */
function formatErrorMessage(error) {
  console.error('=== ERROR DETAILS ===');
  console.error('Code:', error.code);
  console.error('Message:', error.message);
  console.error('Details:', error.details);
  console.error('Hint:', error.hint);
  console.error('===================');

  // Map Postgres error codes to user-friendly messages
  const errorMap = {
    '42503': 'Permission denied: RLS policy violation. Admin does not have INSERT permission on profiles.',
    '23505': 'User with this email already exists.',
    '23503': 'Invalid role or reference. Check that the role exists.',
    '42P01': 'Table does not exist. Check database schema.',
    '42883': 'Function does not exist. Check database functions.',
    'PGRST116': 'RLS policy violation. Check admin role and permissions.',
  };

  return errorMap[error.code] || error.message || 'An unexpected error occurred';
}

/**
 * Generate temporary password
 * @returns {string} Temporary password
 */
export function generateTemporaryPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Get current user ID
 * @returns {Promise<string>} Current user ID
 */
async function getCurrentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('No authenticated user found');
  }
  return user.id;
}

/**
 * Create admin account
 * @param {Object} adminData - Admin user data
 * @returns {Promise<Object>} Created admin user with temporary password
 */
export async function createAdminAccount(adminData) {
  console.log('=== ADMIN ACCOUNT CREATION START ===');
  console.log('Creating admin account:', adminData);
  
  try {
    // Get current user ID for created_by field
    const currentUserId = await getCurrentUserId();
    
    const tempPassword = generateTemporaryPassword();
    
    // 1. Create auth user
    console.log('Step 1: Creating auth user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminData.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: adminData.full_name,
        phone: adminData.phone
      }
    });
    
    if (authError) {
      console.error('Auth creation error:', authError);
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }
    
    const authUserId = authData.user.id;
    console.log('Auth user created:', authUserId);
    
    // 2. Create profile with admin role
    console.log('Step 2: Creating admin profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authUserId,
        full_name: adminData.full_name,
        email: adminData.email,
        phone: adminData.phone,
        role: 'admin',
        primary_role: 'admin',
        is_active: true,
        created_by: currentUserId,
        username: adminData.email.split('@')[0],
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (profileError) {
      console.error('Profile creation error:', profileError);
      console.error('Error code:', profileError.code);
      console.error('Error message:', profileError.message);
      
      // Clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authUserId);
      
      throw new Error(formatErrorMessage(profileError));
    }
    
    console.log('Admin profile created:', profile);
    
    // 3. Assign admin role
    console.log('Step 3: Assigning admin role...');
    try {
      const role = await getRoleByName('admin');
      
      if (role) {
        const { data: userRole, error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: authUserId,
            role_id: role.id,
            assigned_by: currentUserId
          })
          .select();
        
        if (roleError) {
          console.error('Role assignment error:', roleError);
          throw new Error(`Failed to assign admin role: ${roleError.message}`);
        }
        
        console.log('Admin role assigned:', userRole);
      } else {
        console.warn('Admin role not found in roles table');
      }
    } catch (roleError) {
      console.error('Role assignment failed:', roleError);
      // Don't fail the entire admin creation if role assignment fails
    }
    
    // 4. Send WhatsApp notification
    if (adminData.phone) {
      console.log('Step 4: Sending WhatsApp notification...');
      try {
        await sendWhatsAppMessage(
          adminData.phone,
          `Welcome to Alpha Bridge Admin Portal! 🎉\n\nYour admin account has been created.\n\nEmail: ${adminData.email}\nTemporary password: ${tempPassword}\n\nPlease log in and change your password immediately.\n\nBest regards,\nAlpha Bridge Team`
        );
        console.log('WhatsApp notification sent');
      } catch (whatsappError) {
        console.warn('WhatsApp notification failed:', whatsappError);
        // Don't fail admin creation if WhatsApp fails
      }
    }
    
    console.log('=== ADMIN ACCOUNT CREATION SUCCESS ===');
    return {
      success: true,
      user: profile,
      tempPassword: tempPassword,
      message: `Admin account created successfully. Temporary password: ${tempPassword}`
    };
    
  } catch (error) {
    console.error('=== ADMIN ACCOUNT CREATION FAILED ===');
    console.error('Error details:', error);
    
    throw error;
  }
}

/**
 * Create user with role assignment
 * @param {Object} userData - User data object
 * @returns {Promise<Object>} Created user with temporary password
 */
export async function createUserWithRole(userData) {
  console.log('=== USER CREATION START ===');
  console.log('Creating user payload:', userData);
  
  try {
    // Get current user ID for created_by field
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      throw new Error('You must be logged in to create users');
    }
    
    const tempPassword = generateTemporaryPassword();
    
    // 1. Create auth user
    console.log('Step 1: Creating auth user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: userData.full_name,
        phone: userData.phone
      }
    });
    
    if (authError) {
      console.error('Auth creation error:', authError);
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }
    
    const authUserId = authData.user.id;
    console.log('Auth user created:', authUserId);
    
    // 2. Create profile
    console.log('Step 2: Creating profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authUserId,
        full_name: userData.full_name,
        email: userData.email,
        phone: userData.phone,
        role: userData.role || 'guest',
        primary_role: userData.role || 'guest',
        is_active: true,
        created_by: currentUser.id,
        username: userData.email.split('@')[0],
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (profileError) {
      console.error('Profile creation error:', profileError);
      console.error('Error code:', profileError.code);
      console.error('Error message:', profileError.message);
      
      // Clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authUserId);
      
      throw new Error(formatErrorMessage(profileError));
    }
    
    console.log('Profile created:', profile);
    
    // 3. Assign role
    if (userData.role && userData.role !== 'guest') {
      console.log('Step 3: Assigning role:', userData.role);
      try {
        const role = await getRoleByName(userData.role);
        
        if (role) {
          const { data: userRole, error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: authUserId,
              role_id: role.id,
              assigned_by: currentUser.id
            })
            .select();
          
          if (roleError) {
            console.error('Role assignment error:', roleError);
            throw new Error(`Failed to assign role: ${roleError.message}`);
          }
          
          console.log('Role assigned:', userRole);
        } else {
          console.warn('Role not found:', userData.role);
        }
      } catch (roleError) {
        console.error('Role assignment failed:', roleError);
        // Don't fail the entire user creation if role assignment fails
      }
    }
    
    // 4. Send WhatsApp notification
    if (userData.phone) {
      console.log('Step 4: Sending WhatsApp notification...');
      try {
        await sendWhatsAppMessage(
          userData.phone,
          `Welcome to Alpha Bridge! Your account has been created.\n\nEmail: ${userData.email}\nTemporary password: ${tempPassword}\n\nPlease log in to access your dashboard.`
        );
        console.log('WhatsApp notification sent');
      } catch (whatsappError) {
        console.warn('WhatsApp notification failed:', whatsappError);
        // Don't fail user creation if WhatsApp fails
      }
    }
    
    console.log('=== USER CREATION SUCCESS ===');
    return {
      success: true,
      user: profile,
      tempPassword: tempPassword,
      message: `User created successfully. Temporary password: ${tempPassword}`
    };
    
  } catch (error) {
    console.error('=== USER CREATION FAILED ===');
    console.error('Error details:', error);
    
    throw error;
  }
}

/**
 * Update user
 * @param {string} userId - User UUID
 * @param {Object} updates - Updates object
 * @returns {Promise<Object>} Updated user
 */
export async function updateUser(userId, updates) {
  console.log('Updating user:', userId, updates);
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      console.error('User update error:', error);
      throw new Error(formatErrorMessage(error));
    }
    
    console.log('User updated:', data);
    return data;
  } catch (error) {
    console.error('User update error:', error);
    throw error;
  }
}

/**
 * Delete user
 * @param {string} userId - User UUID
 */
export async function deleteUser(userId) {
  console.log('Deleting user:', userId);
  
  try {
    // Delete from profiles (cascade will handle user_roles)
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    
    if (profileError) {
      console.error('Profile deletion error:', profileError);
      throw new Error(formatErrorMessage(profileError));
    }
    
    // Delete auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    
    if (authError) {
      console.error('Auth deletion error:', authError);
      throw new Error(`Failed to delete auth user: ${authError.message}`);
    }
    
    console.log('User deleted:', userId);
  } catch (error) {
    console.error('User deletion error:', error);
    throw error;
  }
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise<boolean>} Success status
 */
export async function sendPasswordResetEmail(email) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/admin/update-password',
    });
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Password reset error:', error);
    throw error;
  }
}

export default {
  generateTemporaryPassword,
  createAdminAccount,
  createUserWithRole,
  updateUser,
  deleteUser,
  sendPasswordResetEmail
};