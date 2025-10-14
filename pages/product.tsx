"use client"

import { useState, FormEvent } from 'react';
import DatePicker from 'react-datepicker';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useAuth } from '@clerk/nextjs';
import { Protect, PricingTable, UserButton } from '@clerk/nextjs';
import decodeJwt from './jwt';

function ConsultationForm() {
    const { getToken } = useAuth();

    // Form state
    const [patientName, setPatientName] = useState('');
    const [visitDate, setVisitDate] = useState<Date | null>(new Date());
    const [notes, setNotes] = useState('');

    // Streaming state
    const [output, setOutput] = useState('');
    const [loading, setLoading] = useState(false);

    // Error state
    const [error, setError] = useState('');

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setOutput('');
        setError(''); // Clear previous errors
        setLoading(true);
    
        // Client-side validation
        if (!patientName.trim()) {
            setError('Patient name is required');
            setLoading(false);
            return;
        }
        if (!visitDate) {
            setError('Date of visit is required');
            setLoading(false);
            return;
        }
        if (!notes.trim()) {
            setError('Consultation notes are required');
            setLoading(false);
            return;
        }
    
        const jwt = await getToken();
        if (!jwt) {
            setOutput('Authentication required');
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        let buffer = '';

        try {
            console.log('Sending request with data:', {
                patient_name: patientName.trim(),
                date_of_visit: visitDate.toISOString().slice(0, 10),
                notes: notes.trim(),
            });
            console.log('JWT decoded:', decodeJwt(jwt));
            
            await fetchEventSource('/api/consultation', {
                signal: controller.signal,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
                body: JSON.stringify({
                    patient_name: patientName.trim(),
                    date_of_visit: visitDate.toISOString().slice(0, 10),
                    notes: notes.trim(),
                }),
                openWhenHidden: true,
                onmessage(ev) {
                    buffer += ev.data;
                    setOutput(buffer);
                },
                onclose() { 
                    setLoading(false); 
                },
                onerror(err) {
                    console.error('SSE error:', err);
                    controller.abort();
                    setLoading(false);
                    
                    // Handle different types of errors
                    if (err instanceof Response) {
                        if (err.status === 403 || err.status === 401) {
                            setError('Authentication failed. Please sign in again.');
                            return; // Prevent retry for auth errors
                        }
                        err.json().then(errorData => {
                            if (errorData.missing_fields) {
                                setError(`Please fill in: ${errorData.missing_fields.join(', ')}`);
                            } else {
                                setError(errorData.message || 'An error occurred while generating the summary');
                            }
                        }).catch(() => {
                            setError('Server error occurred');
                        });
                    } else {
                        setError('Network error occurred');
                    }
                },
            });
        } catch (error) {
            console.error('Request error:', error);
            setError('An error occurred while generating the summary');
            setLoading(false);
        }
    }

    return (
        <div className="container mx-auto px-4 py-12 max-w-3xl">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-8">
                Consultation Notes
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                <div className="space-y-2">
                    <label htmlFor="patient" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Patient Name
                    </label>
                    <input
                        id="patient"
                        type="text"
                        required
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="Enter patient's full name"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Date of Visit
                    </label>
                    <DatePicker
                        id="date"
                        selected={visitDate}
                        onChange={(d: Date | null) => setVisitDate(d)}
                        dateFormat="yyyy-MM-dd"
                        placeholderText="Select date"
                        required
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Consultation Notes
                    </label>
                    <textarea
                        id="notes"
                        required
                        rows={8}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="Enter detailed consultation notes..."
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                >
                    {loading ? 'Generating Summary...' : 'Generate Summary'}
                </button>
            </form>

            {error && (
            <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                            Error
                        </h3>
                        <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                            {error}
                        </div>
                    </div>
                </div>
            </div>
            )}
            {output && (
                <section className="mt-8 bg-gray-50 dark:bg-gray-800 rounded-xl shadow-lg p-8">
                    <div className="markdown-content prose prose-blue dark:prose-invert max-w-none">
                    <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkBreaks]}
                                components={{
                                    h1: ({ children }) => <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">{children}</h1>,
                                    h2: ({ children }) => <h2 className="text-2xl font-bold mb-3 text-gray-800 dark:text-gray-200">{children}</h2>,
                                    h3: ({ children }) => <h3 className="text-xl font-bold mb-2 text-gray-700 dark:text-gray-300">{children}</h3>,
                                    p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
                                    ul: ({ children }) => <ul className="mb-4 space-y-1">{children}</ul>,
                                    ol: ({ children }) => <ol className="mb-4 space-y-1">{children}</ol>,
                                    li: ({ children }) => <li className="flex items-start"><span className="mr-2">•</span>{children}</li>,
                                    code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">{children}</code>,
                                    pre: ({ children }) => <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg overflow-x-auto">{children}</pre>,
                                    blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 dark:text-gray-400">{children}</blockquote>,
                                }}
                            >
                            {output}
                        </ReactMarkdown>
                    </div>
                </section>
            )}
        </div>
    );
}


export default function Product() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
            {/* User Menu in Top Right */}
            <div className="absolute top-4 right-4">
                <UserButton showName={true} />
            </div>

            {/* Subscription Protection */}
            <Protect
                plan="premium"
                fallback={
                    <div className="container mx-auto px-4 py-12">
                        <header className="text-center mb-12">
                            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                                Healthcare Professional Plan
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 text-lg mb-8">
                                Streamline your patient consultations with AI-powered summaries and emails
                            </p>
                        </header>
                        <div className="max-w-4xl mx-auto">
                            <PricingTable />
                        </div>
                    </div>
                }
            >
                <ConsultationForm />
            </Protect>
        </main>
    );
}