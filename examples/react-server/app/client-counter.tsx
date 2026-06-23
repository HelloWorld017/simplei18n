'use client';

import { useState } from 'react';

type ClientCounterProps = {
  title: string;
  countLabel: string;
  incrementLabel: string;
};

export const ClientCounter = ({ title, countLabel, incrementLabel }: ClientCounterProps) => {
  const [count, setCount] = useState(0);

  return (
    <section className='client-card' aria-label={title}>
      <p>{title}</p>
      <strong>
        {countLabel}: {count}
      </strong>
      <button type='button' onClick={() => setCount(value => value + 1)}>
        {incrementLabel}
      </button>
    </section>
  );
};
