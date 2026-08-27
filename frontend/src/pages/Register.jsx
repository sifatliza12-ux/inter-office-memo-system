import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { createOrganization } from '../services/organizations';

const emptyForm = { name: '', identifier: '', adminName: '', adminEmail: '', adminPassword: '' };

function Register() {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await createOrganization(form);

      try {
        await login(form.adminEmail, form.adminPassword);
        navigate('/', { replace: true });
      } catch (loginError) {
        // The organization/admin were created successfully — only the
        // automatic sign-in step failed. Don't report this as a
        // registration failure; point the user at the login page instead.
        setError('Organization created, but automatic sign-in failed. Please sign in manually.');
      }
    } catch (submitError) {
      setError(submitError.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow"
      >
        <h1 className="text-xl font-semibold text-gray-800">Register Organization</h1>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="org-name">
            Organization Name
          </label>
          <input
            id="org-name"
            required
            value={form.name}
            onChange={handleChange('name')}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="org-identifier">
            Organization Identifier
          </label>
          <input
            id="org-identifier"
            required
            value={form.identifier}
            onChange={handleChange('identifier')}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="admin-name">
            Admin Name
          </label>
          <input
            id="admin-name"
            required
            value={form.adminName}
            onChange={handleChange('adminName')}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="admin-email">
            Admin Email
          </label>
          <input
            id="admin-email"
            type="email"
            required
            autoComplete="email"
            value={form.adminEmail}
            onChange={handleChange('adminEmail')}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="admin-password">
            Admin Password
          </label>
          <input
            id="admin-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.adminPassword}
            onChange={handleChange('adminPassword')}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Registering...' : 'Register'}
        </button>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Register;
