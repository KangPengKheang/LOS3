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
      <select
        className="select-input"
        value={filters.losSort}
        onChange={(e) => setFilters((prev) => ({ ...prev, losSort: e.target.value }))}
        aria-label="Sort LOS Days"
      >
        <option value="default">LOS Days: Default</option>
        <option value="asc">LOS Days: Lowest to Highest</option>
        <option value="desc">LOS Days: Highest to Lowest</option>
      </select>
      <button className="export-btn" onClick={onExport}>Export CSV</button>
    </div>
  );
}
