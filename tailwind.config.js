module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cyber-blue': '#00f5ff',
        'neon-green': '#39ff14',
        'electric-purple': '#bf00ff',
        'hot-pink': '#ff1493',
        'laser-orange': '#ff4500',
      },
      fontFamily: {
        'cyber': ['Orbitron', 'monospace'],
      },
      animation: {
        'pulse-neon': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      }
    },
  },
  plugins: [],
}