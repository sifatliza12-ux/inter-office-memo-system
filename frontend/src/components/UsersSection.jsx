import { useCallback, useEffect, useState } from 'react';

import { listUsers, createUser, updateUser, updateUserStatus } from '../services/users';
import { listDepartments } from '../services/departments';
import { useAuth } from '../context/AuthContext.jsx';

const emptyForm = { name: '', email: '', password: '', role: 'employee', designation: '', departmentId: '' };

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
    <section className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Users</h2>
        <button
          onClick={openCreateForm}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          New User
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600" htmlFor="user-status-filter">
            Status
          </label>
          <select
            id="user-status-filter"
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600" htmlFor="user-department-filter">
            Department
          </label>
          <select
            id="user-department-filter"
            value={filters.departmentId}
            onChange={(event) => setFilters({ ...filters, departmentId: event.target.value })}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {departments.map((department) => (
              <option key={department._id} value={department._id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600" htmlFor="user-role-filter">
            Role
          </label>
          <select
            id="user-role-filter"
            value={filters.role}
            onChange={(event) => setFilters({ ...filters, role: event.target.value })}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">All</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="employee">Employee</option>
          </select>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded border border-gray-200 p-4">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              disabled={Boolean(editingId)}
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            />
          </div>
          {!editingId && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Designation</label>
            <input
              value={form.designation}
              onChange={(event) => setForm({ ...form, designation: event.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Department</label>
            <select
              value={form.departmentId}
              onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {departments.map((department) => (
                <option key={department._id} value={department._id}>
                  {department.name}
                  {department.status !== 'active' ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              {editingId ? 'Save' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded bg-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2">Name</th>
            <th className="py-2">Email</th>
            <th className="py-2">Role</th>
            <th className="py-2">Department</th>
            <th className="py-2">Status</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan="6" className="py-4 text-gray-500">
                Loading...
              </td>
            </tr>
          ) : users.length === 0 ? (
            <tr>
              <td colSpan="6" className="py-4 text-gray-500">
                No users found.
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr key={user._id} className="border-b border-gray-100">
                <td className="py-2">{user.name}</td>
                <td className="py-2 text-gray-500">{user.email}</td>
                <td className="py-2">{user.role}</td>
                <td className="py-2">{departmentName(user.departmentId)}</td>
                <td className="py-2">
                  <span className={user.status === 'active' ? 'text-green-600' : 'text-gray-400'}>
                    {user.status}
                  </span>
                </td>
                <td className="space-x-2 py-2">
                  <button onClick={() => openEditForm(user)} className="text-blue-600 hover:underline">
                    Edit
                  </button>
                  <button
                    onClick={() => toggleStatus(user)}
                    disabled={isSelf(user)}
                    title={isSelf(user) ? 'You cannot deactivate your own account' : undefined}
                    className="text-gray-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline"
                  >
                    {user.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

export default UsersSection;
