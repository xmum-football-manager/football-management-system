import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { LiveBadge } from './LiveBadge'

const meta: Meta<typeof LiveBadge> = {
  component: LiveBadge,
}
export default meta

type Story = StoryObj<typeof LiveBadge>

export const Default: Story = {}
