import React from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function PublicDocumentPage({ kind = 'quotation' }) {
  const { id, token } = useParams();
  const src = `${API_BASE}/public/documents/${kind}/${id}/${token}`;
  const title = kind === 'invoice' ? 'Invoice' : 'Quotation';

  return (
    <div className="min-h-screen bg-slate-100">
      <Helmet>
        <title>{title} · Alpha Bridge</title>
      </Helmet>
      <iframe
        title={title}
        src={src}
        className="block h-screen w-full border-0 bg-white"
      />
    </div>
  );
}
