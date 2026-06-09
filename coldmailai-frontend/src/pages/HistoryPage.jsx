import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Copy, Eye, Filter, Search, Star, Trash2, X } from 'lucide-react';
import { deleteEmail, favoriteEmail, getEmails } from '../api';
import useStore from '../store/useStore';

const FALLBACK_DATE = '1970-01-01T00:00:00.000Z';
const normalizeEmail = (email) => {
  const input = email.input || {};
  const output = email.output || {};
  return {
    ...email,
    subject: email.subject || output.subject || 'No subject',
    body: email.body || email.emailBody || output.emailBody || '',
    recipientName: email.recipientName || input.recipientName || '',
    recipientCompany: email.recipientCompany || input.companyName || '',
    tone: email.tone || input.tone || '',
    goal: email.goal || input.goal || '',
    isFavorite: Boolean(email.isFavorite || email.isFavorited),
  };
};
const readEmails = (data) => (data.emails || data.items || data.data || []).map(normalizeEmail);
const readTotal = (data) => data.total || data.totalEmails || data.count || readEmails(data).length;
const pageCount = (total) => Math.max(Math.ceil(total / 12), 1);

export default function HistoryPage() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalEmails, setTotalEmails] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGoal, setFilterGoal] = useState('all');
  const [filterTone, setFilterTone] = useState('all');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const removeEmail = useStore((state) => state.removeEmail);
  const toggleFavorite = useStore((state) => state.toggleFavorite);
  const setStoreEmails = useStore((state) => state.setEmails);

  const fetchEmails = useCallback(async (page, showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const data = await getEmails(page, 12);
      const list = readEmails(data);
      const total = readTotal(data);
      setEmails(list);
      setTotalEmails(total);
      setStoreEmails(list, total);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to fetch emails');
    } finally {
      setLoading(false);
    }
  }, [setStoreEmails]);

  useEffect(() => {
    let active = true;
    getEmails(currentPage, 12)
      .then((data) => {
        if (!active) return;
        const list = readEmails(data);
        const total = readTotal(data);
        setEmails(list);
        setTotalEmails(total);
        setStoreEmails(list, total);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || 'Unable to fetch emails');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentPage, setStoreEmails]);

  const goToPage = (page) => {
    setLoading(true);
    setError('');
    setCurrentPage(page);
  };

  const filteredEmails = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return emails.filter((email) => {
      const matchesQuery =
        !query ||
        `${email.recipientName || ''} ${email.subject || ''} ${email.recipientCompany || ''}`.toLowerCase().includes(query);
      const matchesGoal = filterGoal === 'all' || email.goal === filterGoal;
      const matchesTone = filterTone === 'all' || email.tone === filterTone;
      return matchesQuery && matchesGoal && matchesTone;
    });
  }, [emails, filterGoal, filterTone, searchQuery]);

  const goals = useMemo(() => [...new Set(emails.map((email) => email.goal).filter(Boolean))], [emails]);
  const tones = useMemo(() => [...new Set(emails.map((email) => email.tone).filter(Boolean))], [emails]);

  const handleFavorite = async (event, email) => {
    event.stopPropagation();
    try {
      await favoriteEmail(email.id);
      setEmails((current) => current.map((item) => (item.id === email.id ? { ...item, isFavorite: !item.isFavorite } : item)));
      toggleFavorite(email.id);
      toast.success(email.isFavorite ? 'Removed favorite' : 'Marked favorite');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update favorite');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteEmail(id);
      setEmails((current) => current.filter((email) => email.id !== id));
      removeEmail(id);
      setDeleteConfirm(null);
      setSelectedEmail(null);
      toast.success('Email deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete email');
    }
  };

  const copySelected = async () => {
    if (!selectedEmail) return;
    await navigator.clipboard.writeText(`Subject: ${selectedEmail.subject}\n\n${selectedEmail.body || selectedEmail.content || ''}`);
    toast.success('Copied email');
  };

  const pages = Array.from({ length: pageCount(totalEmails) }, (_, index) => index + 1).filter((page) => Math.abs(page - currentPage) <= 2);

  return (
    <section className="history-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Email History</h1>
          <p className="text-muted">{totalEmails} emails generated</p>
        </div>
        <div className="filters-row">
          <div className="input-wrap">
            <Search className="input-icon" size={17} />
            <input className="input-with-icon" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search emails" />
          </div>
          <select value={filterGoal} onChange={(event) => { setFilterGoal(event.target.value); goToPage(1); }} aria-label="Goal filter">
            <option value="all">All goals</option>
            {goals.map((goal) => <option key={goal}>{goal}</option>)}
          </select>
          <select value={filterTone} onChange={(event) => { setFilterTone(event.target.value); goToPage(1); }} aria-label="Tone filter">
            <option value="all">All tones</option>
            {tones.map((tone) => <option key={tone}>{tone}</option>)}
          </select>
        </div>
      </div>

      {loading && (
        <div className="email-grid">
          {Array.from({ length: 6 }, (_, index) => <div className="skeleton" style={{ height: 180, borderRadius: 'var(--radius-lg)' }} key={index} />)}
        </div>
      )}

      {!loading && error && (
        <div className="center-state">
          <div>
            <Filter size={28} />
            <p style={{ margin: '12px 0 18px' }}>{error}</p>
            <button className="btn btn-ghost" type="button" onClick={() => fetchEmails(currentPage)}>Retry</button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="email-grid">
            {filteredEmails.map((email) => (
              <motion.article className="email-card glass" whileHover={{ y: -2 }} onClick={() => setSelectedEmail(email)} key={email.id}>
                <div className="email-card-top">
                  <div>
                    <div className="email-person">{email.recipientName || 'Unknown recipient'}</div>
                    <div className="email-company">{email.recipientCompany || email.companyName || 'Company not set'}</div>
                  </div>
                  <div className="email-card-actions">
                    <button className="icon-button" type="button" aria-label="Favorite email" onClick={(event) => handleFavorite(event, email)}>
                      <Star size={17} fill={email.isFavorite ? 'var(--yellow)' : 'none'} color={email.isFavorite ? 'var(--yellow)' : 'currentColor'} />
                    </button>
                    <button className="icon-button danger" type="button" aria-label="Delete email" onClick={(event) => { event.stopPropagation(); setDeleteConfirm(email.id); }}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
                <div className="email-subject">{email.subject || 'No subject'}</div>
                <div className="tags-row">
                  {email.tone && <span className="tag tag-blue">{email.tone}</span>}
                  {email.goal && <span className="tag tag-mint">{email.goal}</span>}
                  <span className="tag">{new Date(email.created_at || email.createdAt || FALLBACK_DATE).toLocaleDateString()}</span>
                </div>
                <span className="view-link">
                  <Eye size={15} /> View Email
                </span>
                {deleteConfirm === email.id && (
                  <div className="confirm-bar" onClick={(event) => event.stopPropagation()}>
                    <span>Delete this email?</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-danger btn-small" type="button" onClick={() => handleDelete(email.id)}>Confirm</button>
                      <button className="btn btn-ghost btn-small" type="button" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </motion.article>
            ))}
          </div>
          {filteredEmails.length === 0 && <div className="center-state">No emails match your filters.</div>}
          <div className="pagination">
            <button className="btn btn-ghost btn-small" disabled={currentPage === 1} type="button" onClick={() => goToPage(currentPage - 1)}>Previous</button>
            {pages.map((page) => (
              <button className={`btn btn-ghost btn-small page-button ${page === currentPage ? 'active' : ''}`} type="button" onClick={() => goToPage(page)} key={page}>
                {page}
              </button>
            ))}
            <button className="btn btn-ghost btn-small" disabled={currentPage >= pageCount(totalEmails)} type="button" onClick={() => goToPage(currentPage + 1)}>Next</button>
          </div>
        </>
      )}

      <AnimatePresence>
        {selectedEmail && (
          <motion.div className="modal-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="modal-backdrop" onClick={() => setSelectedEmail(null)} />
            <motion.article className="email-modal" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} transition={{ type: 'spring', stiffness: 240, damping: 24 }}>
              <div className="email-modal-head">
                <div>
                  <h2 className="panel-title">{selectedEmail.recipientName || 'Email preview'}</h2>
                  <p className="text-muted">{selectedEmail.recipientCompany || selectedEmail.companyName}</p>
                </div>
                <button className="icon-button" type="button" onClick={() => setSelectedEmail(null)} aria-label="Close modal"><X size={18} /></button>
              </div>
              <div className="divider" />
              <div className="subject-box">
                <div className="subject-label">Subject</div>
                <div className="subject-text">{selectedEmail.subject}</div>
              </div>
              <pre className="email-body" style={{ marginTop: 16 }}>{selectedEmail.body || selectedEmail.content || ''}</pre>
              <div className="modal-footer" style={{ marginTop: 18 }}>
                <button className="btn btn-ghost" type="button" onClick={copySelected}><Copy size={16} /> Copy</button>
                <button className="btn btn-danger" type="button" onClick={() => handleDelete(selectedEmail.id)}><Trash2 size={16} /> Delete</button>
              </div>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
