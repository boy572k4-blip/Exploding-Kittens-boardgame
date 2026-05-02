// noinspection JSUnusedGlobalSymbols

import plugin from "tailwindcss/plugin";

/** @type {import('tailwindcss').Config} */
export default {
    relative: true,
    content: [
        './index.html',
        './app/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {},
    },
    plugins: [
        plugin(function ({matchUtilities, theme}) {
            matchUtilities(
                {
                    'translate-z': (value) => ({
                        '--tw-translate-z': value,
                        transform: ` translate3d(var(--tw-translate-x), var(--tw-translate-y), var(--tw-translate-z)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))`,
                    }), // this is actual CSS
                },
                {values: theme('translate'), supportsNegativeValues: true}
            );
        })
    ],
};

