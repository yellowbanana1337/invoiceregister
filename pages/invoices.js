import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, []);

  async function fetchInvoices() {
    const { data, error } = await supabase.from('invoices').select('*');
    if (!error) setInvoices(data);
  }

  async function addInvoice() {
    const { data, error } = await supabase.from('invoices').insert([
      { name, amount: parseFloat(amount) }
    ]);
    if (!error) {
      setInvoices([...invoices, ...data]);
      setName('');
      setAmount('');
    }
  }

  return (
    <div>
      <h1>Invoices</h1>
      <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
      <input placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
      <button onClick={addInvoice}>Add Invoice</button>
      <ul>
        {invoices.map(inv => (
          <li key={inv.id}>{inv.name} - {inv.amount}</li>
        ))}
      </ul>
    </div>
  );
}
