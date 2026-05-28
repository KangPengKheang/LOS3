import React from 'react';
import Select from 'react-select';

export default function SearchableSelect({ value, onChange, options, label }) {
  // Convert options to react-select format
  const selectOptions = options.map(option => ({ value: option, label: option }));
  // Add 'All' option at the top
  selectOptions.unshift({ value: 'All', label: `${label}: All` });

  return (
    <Select
      classNamePrefix="searchable-select"
      value={selectOptions.find(opt => opt.value === value) || selectOptions[0]}
      onChange={opt => onChange(opt.value)}
      options={selectOptions}
      placeholder={label}
      isClearable={false}
      isSearchable={true}
      menuPortalTarget={null}
      menuPosition="fixed"
      styles={{
        option: (provided, state) => ({
          ...provided,
          opacity: state.isFocused ? 1 : 0.5, // faint for non-focused
        }),
      }}
      aria-label={label}
    />
  );
}
