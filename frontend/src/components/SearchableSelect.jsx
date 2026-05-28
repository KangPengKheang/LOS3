
import React from 'react';
import Select from 'react-select';

export default function SearchableSelect({ value, onChange, options, label }) {
  // Support both array of strings and array of {value, label}
  let selectOptions = options.map(option =>
    typeof option === 'string' ? { value: option, label: option } : option
  );
  // Add 'All' option at the top if not present
  if (!selectOptions.some(opt => opt.value === 'All')) {
    selectOptions.unshift({ value: 'All', label: `${label}: All` });
  }

  // Custom filter: always show all options
  const customFilterOption = () => true;

  return (
    <Select
      classNamePrefix="searchable-select"
      value={selectOptions.find(opt => opt.value === value) || selectOptions[0]}
      onChange={opt => onChange(opt.value)}
      options={selectOptions}
      placeholder={label}
      isClearable={false}
      isSearchable={true}
      filterOption={customFilterOption}
      styles={{
        option: (provided, state) => {
          const input = state.selectProps.inputValue?.toLowerCase() || '';
          const match = state.data.label.toLowerCase().includes(input);
          return {
            ...provided,
            opacity: state.isFocused || state.isSelected ? 1 : match ? 1 : 0.4,
            display: 'block',
          };
        },
      }}
      aria-label={label}
    />
  );
}
