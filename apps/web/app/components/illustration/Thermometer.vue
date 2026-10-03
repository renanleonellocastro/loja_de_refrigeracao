<!-- A thermometer in the red: something overheated on our side. -->
<template>
  <svg viewBox="0 0 160 120" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <ellipse cx="80" cy="110" rx="44" ry="5" fill="currentColor" opacity="0.12" />
    <path
      d="M70 22a10 10 0 0 1 20 0v52a18 18 0 1 1-20 0Z"
      fill="var(--color-surface)"
      stroke="currentColor"
      stroke-width="3"
    />
    <path d="M80 40v44" stroke="var(--color-danger)" stroke-width="7" />
    <circle cx="80" cy="89" r="10" fill="var(--color-danger)" />
    <path d="M94 32h8M94 46h8M94 60h8" stroke="currentColor" stroke-width="2.5" opacity="0.5" />
    <g stroke="var(--color-warning)" stroke-width="2.5">
      <path d="M40 34c4 6 -4 10 0 16" />
      <path d="M52 24c4 6 -4 10 0 16" />
      <path d="M118 30c4 6 -4 10 0 16" />
    </g>
  </svg>
</template>
