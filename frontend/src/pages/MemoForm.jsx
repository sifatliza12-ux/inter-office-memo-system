import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getMemo, createMemo, updateMemo, submitMemo } from '../services/memos';
import { resubmitMemo } from '../services/workflow';
import { getDirectory } from '../services/directory';
import { uploadAttachment } from '../services/attachments';
import { useAuth } from '../context/AuthContext.jsx';
import ParticipantPicker from '../components/ParticipantPicker.jsx';
import AppShell from '../components/AppShell.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import Input from '../components/ui/Input.jsx';
import Select from '../components/ui/Select.jsx';
import Textarea from '../components/ui/Textarea.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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
  const { user } = useAuth();

  const [form, setForm] = useState(emptyForm);
  const [directory, setDirectory] = useState({ users: [], departments: [] });
  const [loading, setLoading] = useState(isEditing);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [memoStatus, setMemoStatus] = useState('draft');
  // Files picked before the memo exists yet — nothing to upload against
  // until createMemo() returns an id, so these are held locally and
  // uploaded through the existing attachment endpoint right after creation.
  const [stagedFiles, setStagedFiles] = useState([]);
  const [createdMemoId, setCreatedMemoId] = useState(null);

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

  const handleStageFiles = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) {
      return;
    }
    setStagedFiles((previous) => [...previous, ...files]);
  };

  const removeStagedFile = (index) => {
    setStagedFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
  };

  // Uploads every staged file through the same POST /:id/attachments
  // endpoint AttachmentsSection already uses — no new backend behavior, no
  // change to who's allowed to upload. Uses allSettled rather than all so
  // one bad file doesn't stop the rest from going through; returns a
  // human-readable message per failure rather than throwing, since a
  // partial attachment failure should never be treated the same as the
  // memo itself failing to save.
  const uploadStagedFiles = async (memoId) => {
    if (stagedFiles.length === 0) {
      return [];
    }
    const results = await Promise.allSettled(stagedFiles.map((file) => uploadAttachment(memoId, file)));
    return results
      .map((result, index) => ({ result, file: stagedFiles[index] }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ result, file }) => `${file.name}: ${result.reason?.response?.data?.message || 'upload failed'}`);
  };

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
        const newMemoId = data.memo._id;
        const failures = await uploadStagedFiles(newMemoId);
        if (failures.length > 0) {
          setCreatedMemoId(newMemoId);
          setError(
            `Memo created, but ${failures.length} attachment(s) failed to upload: ${failures.join('; ')}. ` +
              'You can retry from the memo page.'
          );
        } else {
          navigate(`/memos/${newMemoId}`);
        }
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
      let failures = [];
      if (isEditing) {
        await updateMemo(id, buildPayload());
      } else {
        const { data } = await createMemo(buildPayload());
        memoId = data.memo._id;
        failures = await uploadStagedFiles(memoId);
      }
      if (isResubmit) {
        await resubmitMemo(memoId);
      } else {
        await submitMemo(memoId);
      }
      if (failures.length > 0) {
        setCreatedMemoId(memoId);
        setError(
          `Memo submitted, but ${failures.length} attachment(s) failed to upload: ${failures.join('; ')}. ` +
            'You can retry from the memo page.'
        );
      } else {
        navigate(`/memos/${memoId}`);
      }
    } catch (submitError) {
      setError(submitError.response?.data?.message || 'Failed to submit memo');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <LoadingSpinner label="Loading..." />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl animate-fade-in-up space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">
            {isEditing ? (isResubmit ? 'Revise Memo' : 'Edit Memo') : 'New Memo'}
          </h1>
          <Link to="/memos" className="text-sm font-medium text-plum-700 hover:underline">
            Back to My Memos
          </Link>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
            {createdMemoId && (
              <>
                {' '}
                <Link to={`/memos/${createdMemoId}`} className="underline">
                  Go to memo
                </Link>
              </>
            )}
          </p>
        )}

        <form onSubmit={saveDraft} className="space-y-6">
          {/* Document composer — styled like a real memo letterhead rather
              than a generic settings form. */}
          <Card className="space-y-5">
            <div className="border-b border-stone-200 pb-4 text-center">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-terracotta-500">Memorandum</p>
            </div>

            <div className="grid grid-cols-1 gap-3 border-b border-stone-100 pb-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-4 sm:gap-y-2">
              <label htmlFor="memo-department" className="text-sm font-medium text-stone-500">
                To
              </label>
              <Select
                id="memo-department"
                value={form.departmentId}
                onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
                className="sm:max-w-xs"
              >
                <option value="">Select a department</option>
                {directory.departments.map((department) => (
                  <option key={department._id} value={department._id}>
                    {department.name}
                  </option>
                ))}
              </Select>

              <span className="text-sm font-medium text-stone-500">From</span>
              <span className="text-sm text-stone-800">{user?.name}</span>
            </div>

            <Field label="Subject" htmlFor="memo-subject" required>
              <Input
                id="memo-subject"
                required
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
                placeholder="Annual Budget Review"
                className="!text-base font-medium"
              />
            </Field>

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="memo-body">
                Body
                <span className="ml-0.5 text-terracotta-500">*</span>
              </label>
              <Textarea
                id="memo-body"
                required
                rows={12}
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
                placeholder="Dear colleagues,&#10;&#10;Write the memo content here..."
                className="leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-stone-100 pt-5">
              <Field label="Category" htmlFor="memo-category">
                <Select
                  id="memo-category"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Priority" htmlFor="memo-priority">
                <Select
                  id="memo-priority"
                  value={form.priority}
                  onChange={(event) => setForm({ ...form, priority: event.target.value })}
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card as="section">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Participants</h2>
            <div className="mt-3">
              <ParticipantPicker
                users={directory.users}
                selectedIds={form.workflowParticipants}
                onChange={(ids) => setForm({ ...form, workflowParticipants: ids })}
              />
            </div>
          </Card>

          {!isEditing && (
            <Card as="section">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Attachments</h2>
              <p className="mt-1 text-xs text-stone-400">
                Selected files are uploaded once the memo is created. PDF, Word, Excel, PNG, or JPEG — up to 10MB each.
              </p>
              <input
                type="file"
                multiple
                onChange={handleStageFiles}
                className="mt-3 block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-plum-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-plum-700 hover:file:bg-plum-100"
              />
              {stagedFiles.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {stagedFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between rounded-md border border-stone-200 px-3 py-1.5 text-sm"
                    >
                      <span className="text-stone-700">
                        {file.name} <span className="text-stone-400">({formatSize(file.size)})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeStagedFile(index)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <div className="flex justify-end gap-2">
            <Button type="submit" variant="secondary" disabled={submitting}>
              Save Draft
            </Button>
            <Button type="button" variant="primary" disabled={submitting} onClick={saveAndSubmit}>
              {isResubmit ? 'Resubmit' : 'Submit'}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

export default MemoForm;
