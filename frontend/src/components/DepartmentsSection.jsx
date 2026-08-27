import { useCallback, useEffect, useState } from 'react';

import {
  listDepartments,
  createDepartment,
  updateDepartment,
  updateDepartmentStatus,
} from '../services/departments';

const emptyForm = { name: '', description: '' };

function DepartmentsSection() {
  const [departments, setDepartments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const { data } = await listDepartments(params);
      setDepartments(data.departments);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (department) => {
    setEditingId(department._id);
    setForm({ name: department.name, description: department.description || '' });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    try {
      if (editingId) {
        await updateDepartment(editingId, form);
      } else {
        await createDepartment(form);
      }
      setShowForm(false);
      await fetchDepartments();
    } catch (submitError) {
      setFormError(submitError.response?.data?.message || 'Failed to save department');
    }
  };

  const toggleStatus = async (department) => {
    const nextStatus = department.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDepartmentStatus(department._id, nextStatus);
      await fetchDepartments();
    } catch (toggleError) {
      setError(toggleError.response?.data?.message || 'Failed to update department status');
    }
  };

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Departments</h2>
        <button
          onClick={openCreateForm}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          New Department
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <label className="text-sm text-gray-600" htmlFor="dept-status-filter">
          Status
        </label>
        <select
          id="dept-status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
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
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
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
            <th className="py-2">Description</th>
            <th className="py-2">Status</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan="4" className="py-4 text-gray-500">
                Loading...
              </td>
            </tr>
          ) : departments.length === 0 ? (
            <tr>
              <td colSpan="4" className="py-4 text-gray-500">
                No departments found.
              </td>
            </tr>
          ) : (
            departments.map((department) => (
              <tr key={department._id} className="border-b border-gray-100">
                <td className="py-2">{department.name}</td>
                <td className="py-2 text-gray-500">{department.description}</td>
                <td className="py-2">
                  <span className={department.status === 'active' ? 'text-green-600' : 'text-gray-400'}>
                    {department.status}
                  </span>
                </td>
                <td className="space-x-2 py-2">
                  <button onClick={() => openEditForm(department)} className="text-blue-600 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => toggleStatus(department)} className="text-gray-600 hover:underline">
                    {department.status === 'active' ? 'Deactivate' : 'Activate'}
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

export default DepartmentsSection;
