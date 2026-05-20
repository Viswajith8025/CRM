import { useNotificationsStore } from '@/modules/notifications'
import { supabase } from '@/lib/supabase'

/**
 * Centralized service for triggering automated notifications
 * and managing common notification patterns.
 */
export const notificationService = {
  /**
   * Triggered when a task is assigned or reassigned
   */
  async notifyTaskAssignment(taskId: string, userId: string, taskTitle: string) {
    if (!userId) return
    
    await useNotificationsStore.getState().addNotification({
      user_id: userId,
      title: 'New Task Assigned',
      description: `You have been assigned to task: "${taskTitle}"`,
      type: 'assignment',
      link: `/tasks?id=${taskId}`
    })
  },

  /**
   * Triggered when a new invoice is issued to a client
   */
  async notifyInvoiceCreated(invoiceId: string, invoiceNumber: string, amount: number) {
    const { data: users } = await supabase.rpc('get_users_with_permission', { p_permission_code: 'module.billing' })

    if (users) {
      for (const user of users) {
        await useNotificationsStore.getState().addNotification({
          user_id: user.id,
          title: 'Invoice Issued',
          description: `Invoice ${invoiceNumber} for $${amount.toLocaleString()} has been created.`,
          type: 'billing',
          link: `/billing/${invoiceId}`
        })
      }
    }
  },

  /**
   * Triggered when a payment is recorded
   */
  async notifyPaymentReceived(invoiceId: string, amount: number) {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('id', invoiceId)
      .single()

    const { data: users } = await supabase.rpc('get_users_with_permission', { p_permission_code: 'module.billing' })

    if (users) {
      for (const user of users) {
        await useNotificationsStore.getState().addNotification({
          user_id: user.id,
          title: 'Payment Received',
          description: `Payment of $${amount.toLocaleString()} received for Invoice ${invoice?.invoice_number || ''}`,
          type: 'billing',
          link: `/billing/${invoiceId}`
        })
      }
    }
  },

  /**
   * Triggered when project details or status change
   */
  async notifyProjectUpdate(projectId: string, projectName: string, updateType: string) {
    // Notify all project members
    const { data: members } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)

    if (members) {
      for (const member of members) {
        await useNotificationsStore.getState().addNotification({
          user_id: member.user_id,
          title: 'Project Update',
          description: `Project "${projectName}" has been ${updateType}.`,
          type: 'project',
          link: `/projects/${projectId}`
        })
      }
    }
  }
}

