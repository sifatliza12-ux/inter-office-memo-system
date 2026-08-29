import { useCallback, useEffect, useState } from 'react';

import { listUsers, createUser, updateUser, updateUserStatus } from '../services/users';
import { listDepartments } from '../services/departments';
import { useAuth } from '../context/AuthContext.jsx';
import { isValidPassword, PASSWORD_REQUIREMENTS_MESSAGE } from '../utils/passwordPolicy';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import Select from './ui/Select.jsx';
import Field from './ui/Field.jsx';
import Input from './ui/Input.jsx';
import PasswordRequirements from './ui/PasswordRequirements.jsx';
import { Table, THead, Th, Tr, Td } from './ui/Table.jsx';
import EmptyState from './ui/EmptyState.jsx';
import LoadingSpinner from './ui/LoadingSpinner.jsx';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'employee',
  designation: '',
  departmentId: '',
};

function UsersSection() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({ status: '', departmentId: '', role: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const fetchDepartments = useCallback(async () => {
    try {
      const { data } = await listDepartments();
      setDepartments(data.departments);
    } catch {
      setDepartments([]);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.departmentId) params.departmentId = filters.departmentId;
      if (filters.role) params.role = filters.role;

      const { data } = await listUsers(params);
      setUsers(data.users);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (user) => {
    setEditingId(user._id);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      confirmPassword: '',
      role: user.role,
      designation: user.designation || '',
      departmentId: user.departmentId || '',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    // Client-side validation is a convenience only — the backend enforces
    // the same policy authoritatively and rejects an invalid password
    // regardless of what happens here. Only relevant on create; edit never
    // sends a password.
    if (!editingId) {
      if (!isValidPassword(form.password)) {
        setFormError(PASSWORD_REQUIREMENTS_MESSAGE);
        return;
      }
      if (form.password !== form.confirmPassword) {
        setFormError('Passwords do not match.');
        return;
      }
    }

    try {
      if (editingId) {
        await updateUser(editingId, {
          name: form.name,
          designation: form.designation,
          role: form.role,
          departmentId: form.departmentId || null,
        });
      } else {
        await createUser({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          designation: form.designation,
          departmentId: form.departmentId || undefined,
        });
      }
      setShowForm(false);
      await fetchUsers();
    } catch (submitError) {
      setFormError(submitError.response?.data?.message || 'Failed to save user');
    }
  };

  const toggleStatus = async (user) => {
    const nextStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await updateUserStatus(user._id, nextStatus);
      await fetchUsers();
    } catch (toggleError) {
      setError(toggleError.response?.data?.message || 'Failed to update user status');
    }
  };

  const departmentName = (id) => departments.find((department) => department._id === id)?.name || '—';
  const isSelf = (user) => currentUser && user._id === currentUser._id;

  return (
    <Card as="section">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-800">Users</h2>
        <Button variant="primary" size="sm" onClick={openCreateForm}>
          New User
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-stone-500" htmlFor="user-status-filter">
            Status
          </label>
          <Select
            id="user-status-filter"
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            className="w-36"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-stone-500" htmlFor="user-department-filter">
            Department
          </label>
          <Select
            id="user-department-filter"
            value={filters.departmentId}
            onChange={(event) => setFilters({ ...filters, departmentId: event.target.value })}
            className="w-44"
          >
            <option value="">All</option>
            {departments.map((department) => (
              <option key={department._id} value={department._id}>
                {department.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-stone-500" htmlFor="user-role-filter">
            Role
          </label>
          <Select
            id="user-role-filter"
            value={filters.role}
            onChange={(event) => setFilters({ ...filters, role: event.target.value })}
            className="w-36"
          >
            <option value="">All</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="employee">Employee</option>
          </Select>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-lg border border-stone-200 bg-stone-50/50 p-4">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Field label="Name" htmlFor="user-name" required>
            <Input
              id="user-name"
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="Email" htmlFor="user-email" required>
            <Input
              id="user-email"
              type="email"
              required
              disabled={Boolean(editingId)}
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </Field>
          {!editingId && (
            <>
              <Field label="Password" htmlFor="user-password" required>
                <Input
                  id="user-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
                <PasswordRequirements password={form.password} />
              </Field>
              <Field label="Confirm Password" htmlFor="user-confirm-password" required>
                <Input
                  id="user-confirm-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                />
              </Field>
            </>
          )}
          <Field label="Designation" htmlFor="user-designation">
            <Input
              id="user-designation"
              value={form.designation}
              onChange={(event) => setForm({ ...form, designation: event.target.value })}
            />
          </Field>
          <Field label="Role" htmlFor="user-role">
            <Select id="user-role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
          <Field label="Department" htmlFor="user-department">
            <Select
              id="user-department"
              value={form.departmentId}
              onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
            >
              <option value="">None</option>
              {departments.map((department) => (
                <option key={department._id} value={department._id}>
                  {department.name}
                  {department.status !== 'active' ? ' (inactive)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm">
              {editingId ? 'Save' : 'Create'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="mt-4">
        <Table>
          <THead>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Role</Th>
            <Th>Department</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </THead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="px-4 py-6">
                  <LoadingSpinner label="Loading..." />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="6">
                  <EmptyState title="No users found" />
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <Tr key={user._id}>
                  <Td className="font-medium text-stone-800">{user.name}</Td>
                  <Td className="text-stone-500">{user.email}</Td>
                  <Td className="capitalize">{user.role}</Td>
                  <Td>{departmentName(user.departmentId)}</Td>
                  <Td>
                    <span
                      className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                        user.status === 'active' ? 'text-emerald-700' : 'text-stone-500'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                      {user.status}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex gap-3">
                      <button onClick={() => openEditForm(user)} className="text-sm font-medium text-blue-700 hover:underline">
                        Edit
                      </button>
                      <button
                        onClick={() => toggleStatus(user)}
                        disabled={isSelf(user)}
                        title={isSelf(user) ? 'You cannot deactivate your own account' : undefined}
                        className="text-sm font-medium text-stone-500 hover:underline disabled:cursor-not-allowed disabled:text-stone-300 disabled:no-underline"
                      >
                        {user.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}

export default UsersSection;
