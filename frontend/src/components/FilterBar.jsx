
import React from 'react';
import SearchableSelect from './SearchableSelect.jsx';

export default function FilterBar({ filters, setFilters, branches, rms, products, statuses, onExport }) {
  return (
    <div className="filter-row">
      <input
        className="search-input"
        placeholder="Search by ID, Customer, Branch, RM..."
        value={filters.search}
        onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
      />
      <SearchableSelect label="Status" value={filters.status} onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))} options={statuses} />
      <SearchableSelect label="Branch" value={filters.branch} onChange={(value) => setFilters((prev) => ({ ...prev, branch: value }))} options={branches} />
      <SearchableSelect label="RM" value={filters.rm} onChange={(value) => setFilters((prev) => ({ ...prev, rm: value }))} options={rms} />
      <SearchableSelect label="Product" value={filters.product} onChange={(value) => setFilters((prev) => ({ ...prev, product: value }))} options={products} />
      <SearchableSelect
        label="LOS Days"
        value={filters.losSort}
        onChange={(value) => setFilters((prev) => ({ ...prev, losSort: value }))}
        options={["default", "asc", "desc"]}
      />
      <button className="export-btn" onClick={onExport}>Export CSV</button>
    </div>
  );
}
