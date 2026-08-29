import { useCallback, useEffect, useState } from 'react';

import {
  listWorkflowTemplates,
  createWorkflowTemplate,
  updateWorkflowTemplate,
  deactivateWorkflowTemplate,
} from '../services/workflowTemplates';
import Card from './ui/Card.jsx';
import { Badge } from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import Field from './ui/Field.jsx';
import Input from './ui/Input.jsx';
import EmptyState from './ui/EmptyState.jsx';
import LoadingSpinner from './ui/LoadingSpinner.jsx';

const emptyForm = { name: '', positions: [{ roleLabel: '' }] };

function WorkflowTemplateCard({ template, onEdit, onDeactivate }) {
  const chain = ['Author', ...template.positions.map((position) => position.roleLabel)].join(' → ');

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-stone-800">{template.name}</p>
        <Badge color={template.status === 'active' ? 'blue' : 'neutral'}>{template.status}</Badge>
      </div>
      <p className="text-sm text-stone-500">{chain}</p>
      <div className="flex gap-3 border-t border-stone-100 pt-3">
        <button type="button" onClick={() => onEdit(template)} className="text-sm font-medium text-blue-700 hover:underline">
          Edit
        </button>
        {template.status === 'active' && (
          <button
            type="button"
            onClick={() => onDeactivate(template)}
            className="text-sm font-medium text-red-600 hover:underline"
          >
            Deactivate
          </button>
        )}
      </div>
    </Card>
  );
}

function WorkflowTemplatesSection() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Admin management view needs inactive templates too (to show their
      // status/keep them editable-to-view), unlike the memo-creation picker.
      const { data } = await listWorkflowTemplates({ includeInactive: true });
      setTemplates(data.workflowTemplates);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load workflow templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (template) => {
    setEditingId(template._id);
    setForm({ name: template.name, positions: template.positions.map((position) => ({ roleLabel: position.roleLabel })) });
    setFormError('');
    setShowForm(true);
  };

  const updatePositionLabel = (index, value) => {
    setForm((previous) => ({
      ...previous,
      positions: previous.positions.map((position, positionIndex) =>
        positionIndex === index ? { roleLabel: value } : position
      ),
    }));
  };

  const addPositionRow = () => {
    setForm((previous) => ({ ...previous, positions: [...previous.positions, { roleLabel: '' }] }));
  };

  const removePositionRow = (index) => {
    setForm((previous) => ({
      ...previous,
      positions: previous.positions.filter((_, positionIndex) => positionIndex !== index),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    try {
      const payload = { name: form.name, positions: form.positions };
      if (editingId) {
        await updateWorkflowTemplate(editingId, payload);
      } else {
        await createWorkflowTemplate(payload);
      }
      setShowForm(false);
      await fetchTemplates();
    } catch (submitError) {
      setFormError(submitError.response?.data?.message || 'Failed to save workflow template');
    }
  };

  const handleDeactivate = async (template) => {
    try {
      await deactivateWorkflowTemplate(template._id);
      await fetchTemplates();
    } catch (deactivateError) {
      setError(deactivateError.response?.data?.message || 'Failed to deactivate workflow template');
    }
  };

  return (
    <Card as="section">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-800">Workflow Templates</h2>
        <Button variant="primary" size="sm" onClick={openCreateForm}>
          New Template
        </Button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-lg border border-stone-200 bg-stone-50/50 p-4">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Field label="Name" htmlFor="template-name" required>
            <Input
              id="template-name"
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium text-stone-700">
              Positions (approval order)
              <span className="ml-0.5 text-tangerine-500">*</span>
            </p>
            <div className="space-y-2">
              {form.positions.map((position, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={index} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-sm text-stone-500">{index + 1}.</span>
                  <Input
                    required
                    placeholder="e.g. Line Manager"
                    value={position.roleLabel}
                    onChange={(event) => updatePositionLabel(index, event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removePositionRow(index)}
                    disabled={form.positions.length === 1}
                    className="shrink-0 text-xs font-medium text-red-600 hover:underline disabled:text-stone-300 disabled:no-underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addPositionRow} className="mt-2 text-sm font-medium text-blue-700 hover:underline">
              + Add position
            </button>
          </div>
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
        {loading ? (
          <LoadingSpinner label="Loading..." />
        ) : templates.length === 0 ? (
          <EmptyState title="No workflow templates found" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {templates.map((template) => (
              <WorkflowTemplateCard key={template._id} template={template} onEdit={openEditForm} onDeactivate={handleDeactivate} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export default WorkflowTemplatesSection;
