import { useCallback, useEffect, useState } from 'react';

import {
  listDepartments,
  createDepartment,
  updateDepartment,
  updateDepartmentStatus,
} from '../services/departments';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import Select from './ui/Select.jsx';
import Field from './ui/Field.jsx';
import Input from './ui/Input.jsx';
import Textarea from './ui/Textarea.jsx';
import { Table, THead, Th, Tr, Td } from './ui/Table.jsx';
import EmptyState from './ui/EmptyState.jsx';
import LoadingSpinner from './ui/LoadingSpinner.jsx';

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
    <Card as="section">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-800">Departments</h2>
        <Button variant="primary" size="sm" onClick={openCreateForm}>
          New Department
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <label className="text-sm text-stone-500" htmlFor="dept-status-filter">
          Status
        </label>
        <Select
          id="dept-status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="w-40"
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-lg border border-stone-200 bg-stone-50/50 p-4">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Field label="Name" htmlFor="dept-name" required>
            <Input
              id="dept-name"
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="Description" htmlFor="dept-description">
            <Textarea
              id="dept-description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
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
            <Th>Description</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </THead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" className="px-4 py-6">
                  <LoadingSpinner label="Loading..." />
                </td>
              </tr>
            ) : departments.length === 0 ? (
              <tr>
                <td colSpan="4">
                  <EmptyState title="No departments found" />
                </td>
              </tr>
            ) : (
              departments.map((department) => (
                <Tr key={department._id}>
                  <Td className="font-medium text-stone-800">{department.name}</Td>
                  <Td className="text-stone-500">{department.description}</Td>
                  <Td>
                    <span
                      className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                        department.status === 'active' ? 'text-emerald-700' : 'text-stone-400'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${department.status === 'active' ? 'bg-emerald-500' : 'bg-stone-300'}`}
                      />
                      {department.status}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex gap-3">
                      <button onClick={() => openEditForm(department)} className="text-sm font-medium text-plum-700 hover:underline">
                        Edit
                      </button>
                      <button onClick={() => toggleStatus(department)} className="text-sm font-medium text-stone-500 hover:underline">
                        {department.status === 'active' ? 'Deactivate' : 'Activate'}
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

export default DepartmentsSection;
