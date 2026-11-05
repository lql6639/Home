/**
 * 农历换算与生日匹配
 * 用浏览器内置的中国农历日历（Intl），不引第三方库
 */

// 农历月的中文写法 → 数字
const LUNAR_MONTH = {
  正月: 1,
  一月: 1,
  二月: 2,
  三月: 3,
  四月: 4,
  五月: 5,
  六月: 6,
  七月: 7,
  八月: 8,
  九月: 9,
  十月: 10,
  冬月: 11,
  十一月: 11,
  腊月: 12,
  十二月: 12
}

// 旧版 Safari 等环境会静默回退到公历，那种结果不能当农历用
const createFormatter = () => {
  const formatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
    month: 'long',
    day: 'numeric',
    // 固定东八区，避免设备时区不同导致午夜前后差一天
    timeZone: 'Asia/Shanghai'
  })
  return formatter.resolvedOptions().calendar === 'chinese' ? formatter : null
}

const formatter = createFormatter()

/**
 * 取某天的农历日期
 * @param {Date} date
 * @returns {{ month: number, day: number, isLeap: boolean } | null} 环境不支持时返回 null
 */

export const lunarOf = (date = new Date()) => {
  if (!formatter) return null

  const parts = formatter.formatToParts(date)
  const get = (type) => parts.find((item) => item.type === type)?.value || ''
  const raw = get('month')

  return {
    isLeap: raw.startsWith('闰'),
    month: LUNAR_MONTH[raw.replace('闰', '')] || 0,
    day: parseInt(get('day'), 10) || 0
  }
}

/**
 * 判断是不是农历某月某日
 * 闰月默认不算（只有过闰月生日时才传 includeLeap）
 */

export const isLunarDay = (
  month,
  day,
  { date = new Date(), includeLeap = false } = {}
) => {
  const lunar = lunarOf(date)
  if (!lunar || !lunar.month) return false
  if (lunar.isLeap && !includeLeap) return false
  return lunar.month === month && lunar.day === day
}

// 判断是不是公历某月某日
export const isSolarDay = (month, day, date = new Date()) =>
  date.getMonth() + 1 === month && date.getDate() === day
