import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getMemo, createMemo, updateMemo, submitMemo } from '../services/memos';
import { resubmitMemo } from '../services/workflow';
import { getDirectory } from '../services/directory';
import ParticipantPicker from '../components/ParticipantPicker.jsx';
import NavBar from '../components/NavBar.jsx';

const CATEGORIES = ['Administrative', 'Financial', 'Procurement', 'HR', 'Academic', 'Technical', 'General'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const emptyForm = {
  subject: '',
  body: '',
  category: 'General',
  priority: 'normal',
  departmentId: '',
  workflowParticipants: [],
};

function MemoForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [directory, setDirectory] = useState({ users: [], departments: [] });
  const [loading, setLoading] = useState(isEditing);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [memoStatus, setMemoStatus] = useState('draft');

  useEffect(() => {
    getDirectory()
      .then(({ data }) => setDirectory(data))
      .catch(() => setDirectory({ users: [], departments: [] }));
  }, []);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    getMemo(id)
      .then(({ data }) => {
        const memo = data.memo;
        if (memo.status !== 'draft' && memo.status !== 'changes_requested') {
          navigate(`/memos/${id}`, { replace: true });
          return;
        }
        setMemoStatus(memo.status);
        setForm({
          subject: memo.subject,
          body: memo.body,
          category: memo.category,
          priority: memo.priority,
          departmentId: memo.departmentId || '',
          workflowParticipants: memo.workflowParticipants || [],
        });
      })
      .catch((fetchError) => setError(fetchError.response?.data?.message || 'Failed to load memo'))
      .finally(() => setLoading(false));
  }, [id, isEditing, navigate]);

  const buildPayload = () => ({
    subject: form.subject,
    body: form.body,
    category: form.category,
    priority: form.priority,
    departmentId: form.departmentId || undefined,
    workflowParticipants: form.workflowParticipants,
  });

  const saveDraft = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isEditing) {
        await updateMemo(id, buildPayload());
        navigate(`/memos/${id}`);
      } else {
        const { data } = await createMemo(buildPayload());
        navigate(`/memos/${data.memo._id}`);
      }
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'Failed to save memo');
    } finally {
      setSubmitting(false);
    }
  };

  const isResubmit = isEditing && memoStatus === 'changes_requested';

  const saveAndSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      let memoId = id;
      if (isEditing) {
        await updateMemo(id, buildPayload());
      } else {
        const { data } = await createMemo(buildPayload());
        memoId = data.memo._id;
      }
      if (isResubmit) {
        await resubmitMemo(memoId);
      } else {
        await submitMemo(memoId);
      }
      navigate(`/memos/${memoId}`);
    } catch (submitError) {
      setError(submitError.response?.data?.message || 'Failed to submit memo');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <form onSubmit={saveDraft} className="mx-auto max-w-3xl space-y-4 rounded-lg bg-white p-6 m-6 shadow">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800">{isEditing ? 'Edit Memo' : 'Create Memo'}</h1>
          <Link to="/memos" className="text-sm text-blue-600 hover:underline">
            Back to My Memos
          </Link>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div>
          <label className="block text-sm font-medium text-gray-700">Subject</label>
          <input
            required
            value={form.subject}
            onChange={(event) => setForm({ ...form, subject: event.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Body</label>
          <textarea
            required
            rows={6}
            value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Priority</label>
            <select
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Department</label>
          <select
            value={form.departmentId}
            onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">None</option>
            {directory.departments.map((department) => (
              <option key={department._id} value={department._id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700">Workflow participants</p>
          <ParticipantPicker
            users={directory.users}
            selectedIds={form.workflowParticipants}
            onChange={(ids) => setForm({ ...form, workflowParticipants: ids })}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={saveAndSubmit}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isResubmit ? 'Resubmit' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default MemoForm;
