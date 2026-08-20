import { StatementData } from '../types';

export function formatWhatsAppMessage(statementData: StatementData): string {
  const { person, balance, period, shopName } = statementData;

  const periodLabel = period === 'all' ? 'Sampurna Hisaab' : period;
  const balanceLabel =
    balance.balanceType === 'LENA_HAI'
      ? `₹${balance.netBalance.toLocaleString('en-IN')} lena hai.`
      : balance.balanceType === 'DENA_HAI'
      ? `₹${balance.netBalance.toLocaleString('en-IN')} dena hai.`
      : '₹0 (Hisaab chukta hai).';

  return `📒 *Hisab Kitab - ${shopName || 'Sharma Kirana Store'}*
_Bolkar hisaab rakho_

👤 *Grahak:* ${person.name}
📅 *Avadhi:* ${periodLabel}
────────────────────
💰 *Kul Diya:* ₹${balance.totalGiven.toLocaleString('en-IN')}
💵 *Kul Prapt:* ₹${balance.totalReceived.toLocaleString('en-IN')}
⚖️ *Baqi Balance:* *${balanceLabel}*
────────────────────
Kripya hisaab ki janch karein. Dhanyawaad!`;
}

export function shareOnWhatsApp(statementData: StatementData): void {
  const text = formatWhatsAppMessage(statementData);
  const encodedText = encodeURIComponent(text);

  let phone = statementData.person.phone ? statementData.person.phone.replace(/[^0-9]/g, '') : '';
  if (phone.length === 10) {
    phone = '91' + phone;
  }

  // Check if native Web Share is supported and has files/text capability
  if (navigator.share) {
    navigator
      .share({
        title: `Hisab Kitab Statement - ${statementData.person.name}`,
        text: text,
      })
      .catch((err) => {
        // Fallback to whatsapp url if user cancelled or failed
        if (err.name !== 'AbortError') {
          openWhatsAppUrl(phone, encodedText);
        }
      });
  } else {
    openWhatsAppUrl(phone, encodedText);
  }
}

function openWhatsAppUrl(phone: string, encodedText: string) {
  if (phone) {
    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`, '_blank');
  } else {
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
  }
}
