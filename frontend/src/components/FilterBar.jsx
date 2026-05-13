import React from 'react';

function Select({ value, onChange, options, label }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="select-input" aria-label={label}>
      <option value="All">{label}: All</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}

export default function FilterBar({ filters, setFilters, branches, products, statuses, onExport }) {
  return (
    <div className="filter-row">
      <input
        className="search-input"
        placeholder="Search by ID, Customer, Branch, RM..."
        value={filters.search}
        onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
      />
      <Select label="Status" value={filters.status} onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))} options={statuses} />
      <Select label="Branch" value={filters.branch} onChange={(value) => setFilters((prev) => ({ ...prev, branch: value }))} options={branches} />
      <Select label="Product" value={filters.product} onChange={(value) => setFilters((prev) => ({ ...prev, product: value }))} options={products} />
      <button className="export-btn" onClick={onExport}>Export CSV</button>
    </div>
  );
}
