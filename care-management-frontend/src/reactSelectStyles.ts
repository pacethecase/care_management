import { CSSObjectWithLabel } from 'react-select';

export const reactSelectStyles = {
  control: (base: CSSObjectWithLabel, state: any): CSSObjectWithLabel => ({
    ...base,
    borderColor: state.isFocused ? 'var(--prussian-blue)' : 'var(--border-muted)',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(247, 127, 0, 0.2)' : 'none',
    '&:hover': {
      borderColor: 'var(--prussian-blue)',
    },
    borderRadius: 6,
    padding: '2px',
  }),
  multiValue: (base: CSSObjectWithLabel): CSSObjectWithLabel => ({
    ...base,
    backgroundColor: '#8ba4ff',
    borderRadius: 4,
  }),
  multiValueLabel: (base: CSSObjectWithLabel): CSSObjectWithLabel => ({
    ...base,
    color:  'var(--prussian-blue)',
  }),
  multiValueRemove: (base: CSSObjectWithLabel): CSSObjectWithLabel => ({
    ...base,
    color: 'var(--prussian-blue)',
    ':hover': {
      backgroundColor: 'var(--prussian-blue)',
      color: 'white',
    },
  }),
};
