import React from 'react';
import SearchSelect from '@/components/erp/SearchSelect';

export function WarehouseSelect({
  value,
  onChange,
  warehouses = [],
  placeholder = 'Search warehouse…',
  allowClear = true,
  className,
  allLabel,
}) {
  const options = [
    ...(allLabel != null ? [{ value: '', label: allLabel }] : []),
    ...warehouses.map((w) => ({ value: w.id, label: w.name })),
  ];
  return (
    <SearchSelect
      className={className}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      allowClear={allowClear}
    />
  );
}

export function BillerSelect({
  value,
  onChange,
  billers = [],
  placeholder = 'Search biller…',
  allowClear = true,
  className,
  allLabel,
}) {
  const options = [
    ...(allLabel != null ? [{ value: '', label: allLabel }] : []),
    ...billers.map((b) => ({ value: b.id, label: b.name })),
  ];
  return (
    <SearchSelect
      className={className}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      allowClear={allowClear}
    />
  );
}
