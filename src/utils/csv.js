export function downloadCSV(filename, rows, headers){
  const arr = [headers, ...rows.map(r => headers.map(h => (r[h] ?? '')))];
  const csv = arr.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
