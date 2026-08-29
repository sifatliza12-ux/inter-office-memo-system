import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { createOrganization } from '../services/organizations';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Field from '../components/ui/Field.jsx';
import Input from '../components/ui/Input.jsx';

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-100 via-blue-50 to-tangerine-50 px-4 py-10">
      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="mb-6 text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-tangerine-500">
            Inter-Office Memo
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">Register Organization</h1>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <Field label="Organization Name" htmlFor="org-name">
              <Input id="org-name" required value={form.name} onChange={handleChange('name')} />
            </Field>

            <Field label="Organization Identifier" htmlFor="org-identifier">
              <Input id="org-identifier" required value={form.identifier} onChange={handleChange('identifier')} />
            </Field>

            <Field label="Admin Name" htmlFor="admin-name">
              <Input id="admin-name" required value={form.adminName} onChange={handleChange('adminName')} />
            </Field>

            <Field label="Admin Email" htmlFor="admin-email">
              <Input
                id="admin-email"
                type="email"
                required
                autoComplete="email"
                value={form.adminEmail}
                onChange={handleChange('adminEmail')}
              />
            </Field>

            <Field label="Admin Password" htmlFor="admin-password">
              <Input
                id="admin-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.adminPassword}
                onChange={handleChange('adminPassword')}
              />
            </Field>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Registering...' : 'Register'}
            </Button>

            <p className="text-center text-sm text-stone-500">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-blue-700 hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default Register;
