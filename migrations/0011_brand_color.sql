-- E1 品牌色统一
--
-- 订单来源的默认色早期是 Element Plus 的 #409EFF，而项目唯一强调色是 Apple Blue #0071e3，
-- 两者同时出现在界面上（Element 蓝的标签 + Apple 蓝的按钮）。
-- 这里把历史默认值归一成品牌蓝。用户自行配置过的渠道色不动：
-- 那是渠道身份标识（美团黄、携程蓝），不属于主题色。
--
-- 注：0001_schema.sql 里 order_sources.color 的 DEFAULT 仍是 '#409EFF'，
-- 但插入时后端始终显式传值（见 orderSources.ts），SQLite 又无法单独改列默认值
-- （需要重建表），因此保持不变，不为此做一次全表重建。

UPDATE order_sources
SET color = '#0071e3'
WHERE color = '#409EFF';
