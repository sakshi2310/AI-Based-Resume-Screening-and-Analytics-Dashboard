import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { getAllUsers, updateUserRole, type AppRole, type AuthUser } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Shield, Users } from 'lucide-react';
import { toast } from 'sonner';

const roles: AppRole[] = ['admin', 'recruiter', 'viewer'];

const AdminUsers = () => {
  const { isAdmin, session } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }

    try {
      const response = await getAllUsers(session.access_token);
      setUsers(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    } else {
      setLoading(false);
    }
  }, [isAdmin, session?.access_token]);

  const handleRoleChange = async (userId: string, role: AppRole) => {
    if (!session?.access_token) return;
    try {
      const updatedUser = await updateUserRole(session.access_token, userId, role);
      setUsers((current) => current.map((user) => (user.id === userId ? updatedUser : user)));
      toast.success('User role updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update role');
    }
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-3">
            <Shield className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
            <p className="text-muted-foreground">Only administrators can access user management.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Users</h1>
          <p className="text-muted-foreground mt-1">Manage user roles for Module 1 authentication.</p>
        </div>

        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Registered Users
            </CardTitle>
            <CardDescription>Users are stored in MongoDB and secured by FastAPI JWT authentication.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading users...</p>}
            {!loading && users.length === 0 && (
              <p className="text-sm text-muted-foreground">No users found yet.</p>
            )}
            {!loading && users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-3 rounded-lg border border-border/50 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{user.full_name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge>
                  <Select value={user.role} onValueChange={(value: AppRole) => handleRoleChange(user.id, value)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminUsers;
