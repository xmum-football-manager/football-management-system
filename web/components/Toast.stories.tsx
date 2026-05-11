import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { Toast } from './Toast'

const meta: Meta<typeof Toast> = {
  component: Toast,
}
export default meta

type Story = StoryObj<typeof Toast>

export const Info: Story = {
  args: {
    message: 'Match schedule updated.',
    variant: 'info',
    duration: 999999,
    onDismiss: fn(),
  },
}

export const Success: Story = {
  args: {
    message: 'Tournament created successfully!',
    variant: 'success',
    duration: 999999,
    onDismiss: fn(),
  },
}

export const Error: Story = {
  args: {
    message: 'Failed to save changes. Please try again.',
    variant: 'error',
    duration: 999999,
    onDismiss: fn(),
  },
}
