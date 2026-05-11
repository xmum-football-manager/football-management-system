import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { QrModal } from './QrModal'

const meta: Meta<typeof QrModal> = {
  component: QrModal,
}
export default meta

type Story = StoryObj<typeof QrModal>

export const Default: Story = {
  args: {
    url: 'https://example.com/t/tour-1/live',
    onClose: fn(),
  },
}

export const LongUrl: Story = {
  args: {
    url: 'https://footballmanager.app/tournaments/summer-invitational-2026/live?ref=qr',
    onClose: fn(),
  },
}
