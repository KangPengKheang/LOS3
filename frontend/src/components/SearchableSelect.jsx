
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

  // Custom filter to keep all options visible, but faint if not matching
  const customFilterOption = (option, input) => {
    if (!input) return true;
    return option.label.toLowerCase().includes(input.toLowerCase());
  };

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
      filterOption={customFilterOption}
      styles={{
        option: (provided, state) => ({
          ...provided,
          opacity:
            state.isFocused || state.isSelected
              ? 1
              : state.data.label.toLowerCase().includes(state.selectProps.inputValue?.toLowerCase() || '')
                ? 1
                : 0.4,
        }),
      }}
      aria-label={label}
    />
  );
}
