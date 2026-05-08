/**
 * 查找数据库中的重复题目
 */

const { pool } = require('./db/connection');

async function findDuplicates() {
  try {
    console.log('正在查找重复题目...\n');
    
    // 查找内容完全相同的题目
    const [duplicates] = await pool.query(`
      SELECT 
        content,
        COUNT(*) as count,
        GROUP_CONCAT(id) as ids,
        GROUP_CONCAT(deck_id) as deck_ids
      FROM questions 
      GROUP BY content 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    
    if (duplicates.length === 0) {
      console.log('✅ 没有找到重复的题目');
      process.exit(0);
    }
    
    console.log(`⚠️ 找到 ${duplicates.length} 组重复题目:\n`);
    
    let totalDuplicates = 0;
    
    for (let i = 0; i < duplicates.length; i++) {
      const dup = duplicates[i];
      const contentPreview = dup.content.substring(0, 80).replace(/\n/g, ' ');
      
      console.log(`${i + 1}. 重复 ${dup.count} 次:`);
      console.log(`   内容: ${contentPreview}${dup.content.length > 80 ? '...' : ''}`);
      console.log(`   题目ID: ${dup.ids}`);
      console.log(`   题库ID: ${dup.deck_ids}`);
      console.log('');
      
      totalDuplicates += dup.count - 1; // 每组保留1个，其余是重复的
    }
    
    console.log(`\n总计: ${duplicates.length} 组重复，共 ${totalDuplicates} 个可删除的重复题目`);
    
    // 统计每个题库的重复情况
    const [deckStats] = await pool.query(`
      SELECT 
        d.name as deck_name,
        d.id as deck_id,
        COUNT(q.id) as total_questions,
        (
          SELECT COUNT(*) FROM (
            SELECT content FROM questions WHERE deck_id = d.id GROUP BY content HAVING COUNT(*) > 1
          ) as dups
        ) as duplicate_groups
      FROM decks d
      LEFT JOIN questions q ON d.id = q.deck_id
      GROUP BY d.id, d.name
      ORDER BY duplicate_groups DESC
    `);
    
    console.log('\n--- 各题库重复情况 ---');
    for (const stat of deckStats) {
      if (stat.duplicate_groups > 0) {
        console.log(`${stat.deck_name}: ${stat.total_questions} 题，${stat.duplicate_groups} 组重复`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }
}

findDuplicates();
