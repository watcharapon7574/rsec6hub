import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
		colors: {
			border: 'hsl(var(--border))',
			input: 'hsl(var(--input))',
			ring: 'hsl(var(--ring))',
			background: 'hsl(var(--background))',
			foreground: 'hsl(var(--foreground))',
			primary: {
				DEFAULT: 'hsl(var(--primary))',
				light: 'hsl(var(--primary-light))',
				dark: 'hsl(var(--primary-dark))',
				foreground: 'hsl(var(--primary-foreground))',
				glow: 'hsl(var(--primary-glow))'
			},
			secondary: {
				DEFAULT: 'hsl(var(--secondary))',
				foreground: 'hsl(var(--secondary-foreground))'
			},
			destructive: {
				DEFAULT: 'hsl(var(--destructive))',
				foreground: 'hsl(var(--destructive-foreground))'
			},
			success: {
				DEFAULT: 'hsl(var(--success))',
				foreground: 'hsl(var(--success-foreground))'
			},
			warning: {
				DEFAULT: 'hsl(var(--warning))',
				foreground: 'hsl(var(--warning-foreground))'
			},
			info: {
				DEFAULT: 'hsl(var(--info))',
				foreground: 'hsl(var(--info-foreground))'
			},
			muted: {
				DEFAULT: 'hsl(var(--muted))',
				foreground: 'hsl(var(--muted-foreground))',
				glass: 'hsl(var(--muted-glass))'
			},
			accent: {
				DEFAULT: 'hsl(var(--accent))',
				foreground: 'hsl(var(--accent-foreground))'
			},
			popover: {
				DEFAULT: 'hsl(var(--popover))',
				foreground: 'hsl(var(--popover-foreground))'
			},
			card: {
				DEFAULT: 'hsl(var(--card))',
				foreground: 'hsl(var(--card-foreground))',
				glass: 'hsl(var(--card-glass))',
				'glass-border': 'hsl(var(--card-glass-border))'
			},
			sidebar: {
				DEFAULT: 'hsl(var(--sidebar-background))',
				foreground: 'hsl(var(--sidebar-foreground))',
				primary: 'hsl(var(--sidebar-primary))',
				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
				accent: 'hsl(var(--sidebar-accent))',
				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
				border: 'hsl(var(--sidebar-border))',
				ring: 'hsl(var(--sidebar-ring))'
			},
			glass: {
				white: 'rgba(255, 255, 255, 0.25)',
				'white-80': 'rgba(255, 255, 255, 0.8)',
				'white-95': 'rgba(255, 255, 255, 0.95)',
				border: 'rgba(255, 255, 255, 0.18)',
				dark: 'rgba(30, 41, 59, 0.25)',
				'dark-80': 'rgba(30, 41, 59, 0.8)'
			}
		},
		borderRadius: {
			lg: 'var(--radius)',
			md: 'calc(var(--radius) - 2px)',
			sm: 'calc(var(--radius) - 4px)',
			xl: 'calc(var(--radius) + 4px)',
			'2xl': 'calc(var(--radius) + 8px)'
		},
		fontFamily: {
			sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'system-ui', 'sans-serif'],
			display: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'system-ui', 'sans-serif']
		},
		backdropBlur: {
			apple: '16px',
			'apple-lg': '40px'
		},
		boxShadow: {
			'glass': '0 10px 40px 0 rgba(59, 130, 246, 0.15)',
			'glass-lg': '0 30px 60px -12px rgba(59, 130, 246, 0.25)',
			'primary': '0 10px 40px rgba(59, 130, 246, 0.3)',
			'primary-lg': '0 20px 50px rgba(59, 130, 246, 0.4)',
			'colored': '0 20px 50px rgba(217, 91, 60, 0.3)',
			'success': '0 10px 30px rgba(34, 197, 94, 0.3)',
			'warning': '0 10px 30px rgba(251, 146, 60, 0.3)',
			'rainbow': '0 20px 40px rgba(59, 130, 246, 0.2)'
		},
		keyframes: {
			'accordion-down': {
				from: {
					height: '0'
				},
				to: {
					height: 'var(--radix-accordion-content-height)'
				}
			},
			'accordion-up': {
				from: {
					height: 'var(--radix-accordion-content-height)'
				},
				to: {
					height: '0'
				}
			},
			'fade-in': {
				'0%': { 
					opacity: '0', 
					transform: 'translateY(10px) scale(0.95)' 
				},
				'100%': { 
					opacity: '1', 
					transform: 'translateY(0) scale(1)' 
				}
			},
			'slide-up': {
				'0%': { 
					opacity: '0', 
					transform: 'translateY(20px)' 
				},
				'100%': { 
					opacity: '1', 
					transform: 'translateY(0)' 
				}
			},
			'scale-in': {
				'0%': { 
					opacity: '0', 
					transform: 'scale(0.95)' 
				},
				'100%': { 
					opacity: '1', 
					transform: 'scale(1)' 
				}
			},
			'glow': {
				'0%, 100%': { 
					boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' 
				},
				'50%': { 
					boxShadow: '0 0 40px rgba(59, 130, 246, 0.8)' 
				}
			},
			'rainbow': {
				'0%': { 
					backgroundPosition: '0% 50%' 
				},
				'50%': { 
					backgroundPosition: '100% 50%' 
				},
				'100%': { 
					backgroundPosition: '0% 50%' 
				}
			},
			'bounce-gentle': {
				'0%, 100%': { 
					transform: 'translateY(0)' 
				},
				'50%': { 
					transform: 'translateY(-5px)' 
				}
			}
		},
		animation: {
			'accordion-down': 'accordion-down 0.2s ease-out',
			'accordion-up': 'accordion-up 0.2s ease-out',
			'fade-in': 'fade-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
			'slide-up': 'slide-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
			'scale-in': 'scale-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
			'glow': 'glow 3s ease-in-out infinite',
			'rainbow': 'rainbow 6s ease infinite',
			'bounce-gentle': 'bounce-gentle 2s ease-in-out infinite'
		}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
