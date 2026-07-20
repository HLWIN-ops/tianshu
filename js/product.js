/**
 * 天枢产品层：把计算结果变成可解释、可复访的用户体验。
 * 该文件不依赖 DOM，便于 Node 回归测试和离线运行。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (typeof Bazi !== 'undefined') Bazi.product = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '3.0.0';
  const PROFILE_KEY = 'tianshu.profiles.v1';
  const PROFILE_LIMIT = 30;
  const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // 出生地离线预设：覆盖中国全部省级行政区（含港澳台）的主要城市；
  // 选择后只写入经度和时区，不上传地址。中国大陆及港澳台统一按 UTC+8。
  const CITIES = [
    // 直辖市 / 特别行政区
    { id: 'beijing', name: '北京', region: '中国', longitude: 116.407, tz: 8 },
    { id: 'shanghai', name: '上海', region: '中国', longitude: 121.474, tz: 8 },
    { id: 'tianjin', name: '天津', region: '中国', longitude: 117.200, tz: 8 },
    { id: 'chongqing', name: '重庆', region: '中国', longitude: 106.551, tz: 8 },
    { id: 'hongkong', name: '香港', region: '中国', longitude: 114.169, tz: 8 },
    { id: 'macau', name: '澳门', region: '中国', longitude: 113.543, tz: 8 },
    // 河北
    { id: 'shijiazhuang', name: '石家庄', region: '河北', longitude: 114.514, tz: 8 },
    { id: 'baoding', name: '保定', region: '河北', longitude: 115.465, tz: 8 },
    { id: 'tangshan', name: '唐山', region: '河北', longitude: 118.175, tz: 8 },
    { id: 'handan', name: '邯郸', region: '河北', longitude: 114.539, tz: 8 },
    { id: 'qinhuangdao', name: '秦皇岛', region: '河北', longitude: 119.602, tz: 8 },
    { id: 'cangzhou', name: '沧州', region: '河北', longitude: 116.857, tz: 8 },
    { id: 'langfang', name: '廊坊', region: '河北', longitude: 116.684, tz: 8 },
    { id: 'zhangjiakou', name: '张家口', region: '河北', longitude: 114.887, tz: 8 },
    { id: 'chengde', name: '承德', region: '河北', longitude: 117.939, tz: 8 },
    { id: 'xingtai', name: '邢台', region: '河北', longitude: 114.509, tz: 8 },
    { id: 'hengshui', name: '衡水', region: '河北', longitude: 115.674, tz: 8 },
    // 山西
    { id: 'taiyuan', name: '太原', region: '山西', longitude: 112.549, tz: 8 },
    { id: 'datong', name: '大同', region: '山西', longitude: 113.295, tz: 8 },
    { id: 'linfen', name: '临汾', region: '山西', longitude: 111.522, tz: 8 },
    { id: 'yuncheng', name: '运城', region: '山西', longitude: 111.007, tz: 8 },
    { id: 'yangquan', name: '阳泉', region: '山西', longitude: 113.580, tz: 8 },
    { id: 'changzhi', name: '长治', region: '山西', longitude: 113.116, tz: 8 },
    { id: 'jincheng', name: '晋城', region: '山西', longitude: 112.851, tz: 8 },
    { id: 'shuozhou', name: '朔州', region: '山西', longitude: 112.433, tz: 8 },
    { id: 'xinzhou', name: '忻州', region: '山西', longitude: 112.734, tz: 8 },
    { id: 'luliang', name: '吕梁', region: '山西', longitude: 111.144, tz: 8 },
    { id: 'jinzhong', name: '晋中', region: '山西', longitude: 112.753, tz: 8 },
    // 辽宁
    { id: 'shenyang', name: '沈阳', region: '辽宁', longitude: 123.431, tz: 8 },
    { id: 'dalian', name: '大连', region: '辽宁', longitude: 121.614, tz: 8 },
    { id: 'anshan', name: '鞍山', region: '辽宁', longitude: 122.991, tz: 8 },
    { id: 'fushun', name: '抚顺', region: '辽宁', longitude: 123.957, tz: 8 },
    { id: 'jinzhou', name: '锦州', region: '辽宁', longitude: 121.127, tz: 8 },
    { id: 'yingkou', name: '营口', region: '辽宁', longitude: 122.235, tz: 8 },
    { id: 'dandong', name: '丹东', region: '辽宁', longitude: 124.355, tz: 8 },
    { id: 'panjin', name: '盘锦', region: '辽宁', longitude: 122.070, tz: 8 },
    { id: 'fuxin', name: '阜新', region: '辽宁', longitude: 121.670, tz: 8 },
    { id: 'liaoyang', name: '辽阳', region: '辽宁', longitude: 123.172, tz: 8 },
    { id: 'tieling', name: '铁岭', region: '辽宁', longitude: 123.844, tz: 8 },
    { id: 'chaoyang', name: '朝阳', region: '辽宁', longitude: 120.454, tz: 8 },
    { id: 'huludao', name: '葫芦岛', region: '辽宁', longitude: 120.836, tz: 8 },
    { id: 'benxi', name: '本溪', region: '辽宁', longitude: 123.768, tz: 8 },
    // 吉林
    { id: 'changchun', name: '长春', region: '吉林', longitude: 125.324, tz: 8 },
    { id: 'jilin', name: '吉林', region: '吉林', longitude: 126.549, tz: 8 },
    { id: 'siping', name: '四平', region: '吉林', longitude: 124.371, tz: 8 },
    { id: 'tonghua', name: '通化', region: '吉林', longitude: 125.940, tz: 8 },
    { id: 'baishan', name: '白山', region: '吉林', longitude: 126.428, tz: 8 },
    { id: 'songyuan', name: '松原', region: '吉林', longitude: 124.823, tz: 8 },
    { id: 'baicheng', name: '白城', region: '吉林', longitude: 122.839, tz: 8 },
    { id: 'liaoyuan', name: '辽源', region: '吉林', longitude: 125.145, tz: 8 },
    { id: 'yanji', name: '延吉', region: '吉林', longitude: 129.510, tz: 8 },
    // 黑龙江
    { id: 'harbin', name: '哈尔滨', region: '黑龙江', longitude: 126.642, tz: 8 },
    { id: 'qiqihar', name: '齐齐哈尔', region: '黑龙江', longitude: 123.918, tz: 8 },
    { id: 'mudanjiang', name: '牡丹江', region: '黑龙江', longitude: 129.618, tz: 8 },
    { id: 'jiamusi', name: '佳木斯', region: '黑龙江', longitude: 130.318, tz: 8 },
    { id: 'daqing', name: '大庆', region: '黑龙江', longitude: 125.104, tz: 8 },
    { id: 'jixi', name: '鸡西', region: '黑龙江', longitude: 130.970, tz: 8 },
    { id: 'shuangyashan', name: '双鸭山', region: '黑龙江', longitude: 131.159, tz: 8 },
    { id: 'hegang', name: '鹤岗', region: '黑龙江', longitude: 130.276, tz: 8 },
    { id: 'suihua', name: '绥化', region: '黑龙江', longitude: 126.973, tz: 8 },
    { id: 'yichun', name: '伊春', region: '黑龙江', longitude: 128.841, tz: 8 },
    { id: 'qitaihe', name: '七台河', region: '黑龙江', longitude: 131.003, tz: 8 },
    { id: 'heihe', name: '黑河', region: '黑龙江', longitude: 127.500, tz: 8 },
    // 江苏
    { id: 'nanjing', name: '南京', region: '江苏', longitude: 118.796, tz: 8 },
    { id: 'suzhou', name: '苏州', region: '江苏', longitude: 120.585, tz: 8 },
    { id: 'wuxi', name: '无锡', region: '江苏', longitude: 120.301, tz: 8 },
    { id: 'changzhou', name: '常州', region: '江苏', longitude: 119.974, tz: 8 },
    { id: 'zhenjiang', name: '镇江', region: '江苏', longitude: 119.453, tz: 8 },
    { id: 'yangzhou', name: '扬州', region: '江苏', longitude: 119.421, tz: 8 },
    { id: 'taizhou-js', name: '泰州', region: '江苏', longitude: 119.923, tz: 8 },
    { id: 'nantong', name: '南通', region: '江苏', longitude: 120.894, tz: 8 },
    { id: 'yancheng', name: '盐城', region: '江苏', longitude: 120.157, tz: 8 },
    { id: 'xuzhou', name: '徐州', region: '江苏', longitude: 117.284, tz: 8 },
    { id: 'lianyungang', name: '连云港', region: '江苏', longitude: 119.222, tz: 8 },
    { id: 'huaian', name: '淮安', region: '江苏', longitude: 119.021, tz: 8 },
    { id: 'suqian', name: '宿迁', region: '江苏', longitude: 118.279, tz: 8 },
    // 浙江
    { id: 'hangzhou', name: '杭州', region: '浙江', longitude: 120.155, tz: 8 },
    { id: 'ningbo', name: '宁波', region: '浙江', longitude: 121.550, tz: 8 },
    { id: 'wenzhou', name: '温州', region: '浙江', longitude: 120.699, tz: 8 },
    { id: 'jiaxing', name: '嘉兴', region: '浙江', longitude: 120.755, tz: 8 },
    { id: 'huzhou', name: '湖州', region: '浙江', longitude: 120.087, tz: 8 },
    { id: 'shaoxing', name: '绍兴', region: '浙江', longitude: 120.580, tz: 8 },
    { id: 'jinhua', name: '金华', region: '浙江', longitude: 119.647, tz: 8 },
    { id: 'quzhou', name: '衢州', region: '浙江', longitude: 118.859, tz: 8 },
    { id: 'zhoushan', name: '舟山', region: '浙江', longitude: 122.107, tz: 8 },
    { id: 'taizhou-zj', name: '台州', region: '浙江', longitude: 121.428, tz: 8 },
    { id: 'lishui', name: '丽水', region: '浙江', longitude: 119.922, tz: 8 },
    { id: 'yiwu', name: '义乌', region: '浙江', longitude: 120.076, tz: 8 },
    // 安徽
    { id: 'hefei', name: '合肥', region: '安徽', longitude: 117.227, tz: 8 },
    { id: 'wuhu', name: '芜湖', region: '安徽', longitude: 118.433, tz: 8 },
    { id: 'bengbu', name: '蚌埠', region: '安徽', longitude: 117.363, tz: 8 },
    { id: 'anqing', name: '安庆', region: '安徽', longitude: 117.064, tz: 8 },
    { id: 'huangshan', name: '黄山', region: '安徽', longitude: 118.337, tz: 8 },
    { id: 'fuyang', name: '阜阳', region: '安徽', longitude: 115.820, tz: 8 },
    { id: 'suzhou-ah', name: '宿州', region: '安徽', longitude: 116.965, tz: 8 },
    { id: 'chuzhou', name: '滁州', region: '安徽', longitude: 118.317, tz: 8 },
    { id: 'liuan', name: '六安', region: '安徽', longitude: 116.523, tz: 8 },
    { id: 'bozhou', name: '亳州', region: '安徽', longitude: 115.781, tz: 8 },
    { id: 'chizhou', name: '池州', region: '安徽', longitude: 117.491, tz: 8 },
    { id: 'xuancheng', name: '宣城', region: '安徽', longitude: 118.759, tz: 8 },
    { id: 'maanshan', name: '马鞍山', region: '安徽', longitude: 118.508, tz: 8 },
    { id: 'tongling', name: '铜陵', region: '安徽', longitude: 117.812, tz: 8 },
    { id: 'huainan', name: '淮南', region: '安徽', longitude: 117.018, tz: 8 },
    { id: 'huaibei', name: '淮北', region: '安徽', longitude: 116.798, tz: 8 },
    // 福建
    { id: 'fuzhou', name: '福州', region: '福建', longitude: 119.296, tz: 8 },
    { id: 'xiamen', name: '厦门', region: '福建', longitude: 118.089, tz: 8 },
    { id: 'quanzhou', name: '泉州', region: '福建', longitude: 118.676, tz: 8 },
    { id: 'zhangzhou', name: '漳州', region: '福建', longitude: 117.676, tz: 8 },
    { id: 'putian', name: '莆田', region: '福建', longitude: 119.008, tz: 8 },
    { id: 'longyan', name: '龙岩', region: '福建', longitude: 117.017, tz: 8 },
    { id: 'sanming', name: '三明', region: '福建', longitude: 117.638, tz: 8 },
    { id: 'nanping', name: '南平', region: '福建', longitude: 118.178, tz: 8 },
    { id: 'ningde', name: '宁德', region: '福建', longitude: 119.527, tz: 8 },
    // 江西
    { id: 'nanchang', name: '南昌', region: '江西', longitude: 115.858, tz: 8 },
    { id: 'jiujiang', name: '九江', region: '江西', longitude: 115.993, tz: 8 },
    { id: 'ganzhou', name: '赣州', region: '江西', longitude: 114.935, tz: 8 },
    { id: 'shangrao', name: '上饶', region: '江西', longitude: 117.943, tz: 8 },
    { id: 'fuzhou-jx', name: '抚州', region: '江西', longitude: 116.358, tz: 8 },
    { id: 'yichun-jx', name: '宜春', region: '江西', longitude: 114.391, tz: 8 },
    { id: 'jian', name: '吉安', region: '江西', longitude: 114.993, tz: 8 },
    { id: 'pingxiang', name: '萍乡', region: '江西', longitude: 113.854, tz: 8 },
    { id: 'xinyu', name: '新余', region: '江西', longitude: 114.917, tz: 8 },
    { id: 'yingtan', name: '鹰潭', region: '江西', longitude: 117.069, tz: 8 },
    { id: 'jingdezhen', name: '景德镇', region: '江西', longitude: 117.285, tz: 8 },
    // 山东
    { id: 'jinan', name: '济南', region: '山东', longitude: 117.120, tz: 8 },
    { id: 'qingdao', name: '青岛', region: '山东', longitude: 120.383, tz: 8 },
    { id: 'yantai', name: '烟台', region: '山东', longitude: 121.448, tz: 8 },
    { id: 'weihai', name: '威海', region: '山东', longitude: 122.120, tz: 8 },
    { id: 'weifang', name: '潍坊', region: '山东', longitude: 119.161, tz: 8 },
    { id: 'linyi', name: '临沂', region: '山东', longitude: 118.357, tz: 8 },
    { id: 'zibo', name: '淄博', region: '山东', longitude: 118.055, tz: 8 },
    { id: 'jining', name: '济宁', region: '山东', longitude: 116.588, tz: 8 },
    { id: 'taian', name: '泰安', region: '山东', longitude: 117.089, tz: 8 },
    { id: 'dezhou', name: '德州', region: '山东', longitude: 116.357, tz: 8 },
    { id: 'liaocheng', name: '聊城', region: '山东', longitude: 115.986, tz: 8 },
    { id: 'binzhou', name: '滨州', region: '山东', longitude: 117.972, tz: 8 },
    { id: 'heze', name: '菏泽', region: '山东', longitude: 115.469, tz: 8 },
    { id: 'dongying', name: '东营', region: '山东', longitude: 118.583, tz: 8 },
    { id: 'zaozhuang', name: '枣庄', region: '山东', longitude: 117.324, tz: 8 },
    { id: 'rizhao', name: '日照', region: '山东', longitude: 119.527, tz: 8 },
    // 河南
    { id: 'zhengzhou', name: '郑州', region: '河南', longitude: 113.625, tz: 8 },
    { id: 'luoyang', name: '洛阳', region: '河南', longitude: 112.453, tz: 8 },
    { id: 'kaifeng', name: '开封', region: '河南', longitude: 114.342, tz: 8 },
    { id: 'xinxiang', name: '新乡', region: '河南', longitude: 113.927, tz: 8 },
    { id: 'anyang', name: '安阳', region: '河南', longitude: 114.393, tz: 8 },
    { id: 'jiaozuo', name: '焦作', region: '河南', longitude: 113.242, tz: 8 },
    { id: 'xuchang', name: '许昌', region: '河南', longitude: 113.853, tz: 8 },
    { id: 'nanyang', name: '南阳', region: '河南', longitude: 112.528, tz: 8 },
    { id: 'shangqiu', name: '商丘', region: '河南', longitude: 115.656, tz: 8 },
    { id: 'xinyang', name: '信阳', region: '河南', longitude: 114.075, tz: 8 },
    { id: 'zhoukou', name: '周口', region: '河南', longitude: 114.649, tz: 8 },
    { id: 'zhumadian', name: '驻马店', region: '河南', longitude: 114.022, tz: 8 },
    { id: 'puyang', name: '濮阳', region: '河南', longitude: 115.464, tz: 8 },
    { id: 'sanmenxia', name: '三门峡', region: '河南', longitude: 111.200, tz: 8 },
    { id: 'luohe', name: '漯河', region: '河南', longitude: 114.025, tz: 8 },
    { id: 'pingdingshan', name: '平顶山', region: '河南', longitude: 113.192, tz: 8 },
    { id: 'hebi', name: '鹤壁', region: '河南', longitude: 114.297, tz: 8 },
    { id: 'jiyuan', name: '济源', region: '河南', longitude: 112.602, tz: 8 },
    // 湖北
    { id: 'wuhan', name: '武汉', region: '湖北', longitude: 114.305, tz: 8 },
    { id: 'yichang', name: '宜昌', region: '湖北', longitude: 111.286, tz: 8 },
    { id: 'xiangyang', name: '襄阳', region: '湖北', longitude: 112.144, tz: 8 },
    { id: 'jingzhou', name: '荆州', region: '湖北', longitude: 112.239, tz: 8 },
    { id: 'huangshi', name: '黄石', region: '湖北', longitude: 115.039, tz: 8 },
    { id: 'shiyan', name: '十堰', region: '湖北', longitude: 110.798, tz: 8 },
    { id: 'jingmen', name: '荆门', region: '湖北', longitude: 112.199, tz: 8 },
    { id: 'ezhou', name: '鄂州', region: '湖北', longitude: 114.891, tz: 8 },
    { id: 'xiaogan', name: '孝感', region: '湖北', longitude: 113.917, tz: 8 },
    { id: 'huanggang', name: '黄冈', region: '湖北', longitude: 114.872, tz: 8 },
    { id: 'xianning', name: '咸宁', region: '湖北', longitude: 114.322, tz: 8 },
    { id: 'suizhou', name: '随州', region: '湖北', longitude: 113.382, tz: 8 },
    { id: 'enshi', name: '恩施', region: '湖北', longitude: 109.488, tz: 8 },
    // 湖南
    { id: 'changsha', name: '长沙', region: '湖南', longitude: 112.938, tz: 8 },
    { id: 'zhuzhou', name: '株洲', region: '湖南', longitude: 113.134, tz: 8 },
    { id: 'xiangtan', name: '湘潭', region: '湖南', longitude: 112.944, tz: 8 },
    { id: 'hengyang', name: '衡阳', region: '湖南', longitude: 112.572, tz: 8 },
    { id: 'yueyang', name: '岳阳', region: '湖南', longitude: 113.132, tz: 8 },
    { id: 'changde', name: '常德', region: '湖南', longitude: 111.698, tz: 8 },
    { id: 'yiyang', name: '益阳', region: '湖南', longitude: 112.355, tz: 8 },
    { id: 'shaoyang', name: '邵阳', region: '湖南', longitude: 111.473, tz: 8 },
    { id: 'loudi', name: '娄底', region: '湖南', longitude: 111.994, tz: 8 },
    { id: 'huaihua', name: '怀化', region: '湖南', longitude: 110.001, tz: 8 },
    { id: 'yongzhou', name: '永州', region: '湖南', longitude: 111.608, tz: 8 },
    { id: 'chenzhou', name: '郴州', region: '湖南', longitude: 113.015, tz: 8 },
    { id: 'zhangjiajie', name: '张家界', region: '湖南', longitude: 110.479, tz: 8 },
    { id: 'xiangxi', name: '湘西', region: '湖南', longitude: 109.739, tz: 8 },
    // 广东
    { id: 'guangzhou', name: '广州', region: '广东', longitude: 113.264, tz: 8 },
    { id: 'shenzhen', name: '深圳', region: '广东', longitude: 114.057, tz: 8 },
    { id: 'zhuhai', name: '珠海', region: '广东', longitude: 113.577, tz: 8 },
    { id: 'dongguan', name: '东莞', region: '广东', longitude: 113.752, tz: 8 },
    { id: 'foshan', name: '佛山', region: '广东', longitude: 113.122, tz: 8 },
    { id: 'zhongshan', name: '中山', region: '广东', longitude: 113.382, tz: 8 },
    { id: 'huizhou', name: '惠州', region: '广东', longitude: 114.413, tz: 8 },
    { id: 'jiangmen', name: '江门', region: '广东', longitude: 113.082, tz: 8 },
    { id: 'zhanjiang', name: '湛江', region: '广东', longitude: 110.359, tz: 8 },
    { id: 'maoming', name: '茂名', region: '广东', longitude: 110.925, tz: 8 },
    { id: 'yangjiang', name: '阳江', region: '广东', longitude: 111.982, tz: 8 },
    { id: 'qingyuan', name: '清远', region: '广东', longitude: 113.056, tz: 8 },
    { id: 'shaoguan', name: '韶关', region: '广东', longitude: 113.592, tz: 8 },
    { id: 'zhaoqing', name: '肇庆', region: '广东', longitude: 112.466, tz: 8 },
    { id: 'meizhou', name: '梅州', region: '广东', longitude: 116.118, tz: 8 },
    { id: 'shantou', name: '汕头', region: '广东', longitude: 116.682, tz: 8 },
    { id: 'shanwei', name: '汕尾', region: '广东', longitude: 115.376, tz: 8 },
    { id: 'chaozhou', name: '潮州', region: '广东', longitude: 116.623, tz: 8 },
    { id: 'jieyang', name: '揭阳', region: '广东', longitude: 116.373, tz: 8 },
    { id: 'heyuan', name: '河源', region: '广东', longitude: 114.698, tz: 8 },
    { id: 'yunfu', name: '云浮', region: '广东', longitude: 112.044, tz: 8 },
    // 海南
    { id: 'haikou', name: '海口', region: '海南', longitude: 110.199, tz: 8 },
    { id: 'sanya', name: '三亚', region: '海南', longitude: 109.518, tz: 8 },
    { id: 'sansha', name: '三沙', region: '海南', longitude: 112.339, tz: 8 },
    { id: 'danzhou', name: '儋州', region: '海南', longitude: 109.577, tz: 8 },
    { id: 'wenchang', name: '文昌', region: '海南', longitude: 110.753, tz: 8 },
    { id: 'qionghai', name: '琼海', region: '海南', longitude: 110.466, tz: 8 },
    { id: 'wanning', name: '万宁', region: '海南', longitude: 110.389, tz: 8 },
    { id: 'wuzhishan', name: '五指山', region: '海南', longitude: 109.517, tz: 8 },
    // 四川
    { id: 'chengdu', name: '成都', region: '四川', longitude: 104.066, tz: 8 },
    { id: 'mianyang', name: '绵阳', region: '四川', longitude: 104.679, tz: 8 },
    { id: 'deyang', name: '德阳', region: '四川', longitude: 104.398, tz: 8 },
    { id: 'yibin', name: '宜宾', region: '四川', longitude: 104.641, tz: 8 },
    { id: 'nanchong', name: '南充', region: '四川', longitude: 106.110, tz: 8 },
    { id: 'zigong', name: '自贡', region: '四川', longitude: 104.778, tz: 8 },
    { id: 'luzhou', name: '泸州', region: '四川', longitude: 105.443, tz: 8 },
    { id: 'leshan', name: '乐山', region: '四川', longitude: 103.761, tz: 8 },
    { id: 'neijiang', name: '内江', region: '四川', longitude: 105.058, tz: 8 },
    { id: 'suining', name: '遂宁', region: '四川', longitude: 105.593, tz: 8 },
    { id: 'dazhou', name: '达州', region: '四川', longitude: 107.469, tz: 8 },
    { id: 'guangyuan', name: '广元', region: '四川', longitude: 105.843, tz: 8 },
    { id: 'guangan', name: '广安', region: '四川', longitude: 106.633, tz: 8 },
    { id: 'yaan', name: '雅安', region: '四川', longitude: 103.001, tz: 8 },
    { id: 'ziyang', name: '资阳', region: '四川', longitude: 104.628, tz: 8 },
    { id: 'bazhong', name: '巴中', region: '四川', longitude: 106.754, tz: 8 },
    { id: 'meishan', name: '眉山', region: '四川', longitude: 103.849, tz: 8 },
    { id: 'panzhihua', name: '攀枝花', region: '四川', longitude: 101.719, tz: 8 },
    { id: 'xichang', name: '西昌', region: '四川', longitude: 102.264, tz: 8 },
    // 贵州
    { id: 'guiyang', name: '贵阳', region: '贵州', longitude: 106.630, tz: 8 },
    { id: 'zunyi', name: '遵义', region: '贵州', longitude: 106.928, tz: 8 },
    { id: 'liupanshui', name: '六盘水', region: '贵州', longitude: 104.833, tz: 8 },
    { id: 'anshun', name: '安顺', region: '贵州', longitude: 105.946, tz: 8 },
    { id: 'bijie', name: '毕节', region: '贵州', longitude: 105.285, tz: 8 },
    { id: 'tongren', name: '铜仁', region: '贵州', longitude: 109.180, tz: 8 },
    { id: 'kaili', name: '凯里', region: '贵州', longitude: 107.983, tz: 8 },
    { id: 'dudu', name: '都匀', region: '贵州', longitude: 107.518, tz: 8 },
    { id: 'xingyi', name: '兴义', region: '贵州', longitude: 104.898, tz: 8 },
    // 云南
    { id: 'kunming', name: '昆明', region: '云南', longitude: 102.833, tz: 8 },
    { id: 'qujing', name: '曲靖', region: '云南', longitude: 103.798, tz: 8 },
    { id: 'yuxi', name: '玉溪', region: '云南', longitude: 102.545, tz: 8 },
    { id: 'dali', name: '大理', region: '云南', longitude: 100.226, tz: 8 },
    { id: 'lijiang', name: '丽江', region: '云南', longitude: 100.230, tz: 8 },
    { id: 'honghe', name: '蒙自', region: '云南', longitude: 103.364, tz: 8 },
    { id: 'puer', name: '普洱', region: '云南', longitude: 100.966, tz: 8 },
    { id: 'baoshan', name: '保山', region: '云南', longitude: 99.161, tz: 8 },
    { id: 'zhaotong', name: '昭通', region: '云南', longitude: 103.725, tz: 8 },
    { id: 'lincang', name: '临沧', region: '云南', longitude: 100.093, tz: 8 },
    { id: 'chuxiong', name: '楚雄', region: '云南', longitude: 101.528, tz: 8 },
    { id: 'wenshan', name: '文山', region: '云南', longitude: 104.245, tz: 8 },
    { id: 'xishuangbanna', name: '景洪', region: '云南', longitude: 100.798, tz: 8 },
    { id: 'dehong', name: '芒市', region: '云南', longitude: 98.588, tz: 8 },
    { id: 'diqing', name: '香格里拉', region: '云南', longitude: 99.706, tz: 8 },
    { id: 'nujiang', name: '泸水', region: '云南', longitude: 98.858, tz: 8 },
    // 西藏
    { id: 'lhasa', name: '拉萨', region: '西藏', longitude: 91.117, tz: 8 },
    { id: 'shigatse', name: '日喀则', region: '西藏', longitude: 88.885, tz: 8 },
    { id: 'nyingchi', name: '林芝', region: '西藏', longitude: 94.361, tz: 8 },
    { id: 'qamdo', name: '昌都', region: '西藏', longitude: 97.170, tz: 8 },
    { id: 'shannan', name: '山南', region: '西藏', longitude: 91.768, tz: 8 },
    { id: 'nagqu', name: '那曲', region: '西藏', longitude: 92.051, tz: 8 },
    { id: 'ngari', name: '狮泉河', region: '西藏', longitude: 80.105, tz: 8 },
    // 陕西
    { id: 'xian', name: '西安', region: '陕西', longitude: 108.940, tz: 8 },
    { id: 'baoji', name: '宝鸡', region: '陕西', longitude: 107.145, tz: 8 },
    { id: 'xianyang', name: '咸阳', region: '陕西', longitude: 108.705, tz: 8 },
    { id: 'weinan', name: '渭南', region: '陕西', longitude: 109.503, tz: 8 },
    { id: 'hanzhong', name: '汉中', region: '陕西', longitude: 107.023, tz: 8 },
    { id: 'ankang', name: '安康', region: '陕西', longitude: 109.027, tz: 8 },
    { id: 'shangluo', name: '商洛', region: '陕西', longitude: 109.940, tz: 8 },
    { id: 'yanan', name: '延安', region: '陕西', longitude: 109.491, tz: 8 },
    { id: 'yulin-sx', name: '榆林', region: '陕西', longitude: 109.729, tz: 8 },
    { id: 'tongchuan', name: '铜川', region: '陕西', longitude: 109.029, tz: 8 },
    // 甘肃
    { id: 'lanzhou', name: '兰州', region: '甘肃', longitude: 103.834, tz: 8 },
    { id: 'tianshui', name: '天水', region: '甘肃', longitude: 105.724, tz: 8 },
    { id: 'baiyin', name: '白银', region: '甘肃', longitude: 104.139, tz: 8 },
    { id: 'qingyang', name: '庆阳', region: '甘肃', longitude: 107.644, tz: 8 },
    { id: 'pingliang', name: '平凉', region: '甘肃', longitude: 106.665, tz: 8 },
    { id: 'dingxi', name: '定西', region: '甘肃', longitude: 104.626, tz: 8 },
    { id: 'longnan', name: '陇南', region: '甘肃', longitude: 104.922, tz: 8 },
    { id: 'wuwei', name: '武威', region: '甘肃', longitude: 102.638, tz: 8 },
    { id: 'zhangye', name: '张掖', region: '甘肃', longitude: 100.449, tz: 8 },
    { id: 'jiuquan', name: '酒泉', region: '甘肃', longitude: 98.494, tz: 8 },
    { id: 'jiayuguan', name: '嘉峪关', region: '甘肃', longitude: 98.277, tz: 8 },
    { id: 'jinchang', name: '金昌', region: '甘肃', longitude: 102.188, tz: 8 },
    { id: 'linxia', name: '临夏', region: '甘肃', longitude: 103.210, tz: 8 },
    { id: 'gannan', name: '合作', region: '甘肃', longitude: 102.911, tz: 8 },
    // 青海
    { id: 'xining', name: '西宁', region: '青海', longitude: 101.778, tz: 8 },
    { id: 'haidong', name: '海东', region: '青海', longitude: 102.104, tz: 8 },
    { id: 'geermu', name: '格尔木', region: '青海', longitude: 94.909, tz: 8 },
    { id: 'yushu', name: '玉树', region: '青海', longitude: 97.008, tz: 8 },
    { id: 'delingha', name: '德令哈', region: '青海', longitude: 97.366, tz: 8 },
    // 宁夏
    { id: 'yinchuan', name: '银川', region: '宁夏', longitude: 106.230, tz: 8 },
    { id: 'shizuishan', name: '石嘴山', region: '宁夏', longitude: 106.376, tz: 8 },
    { id: 'wuzhong', name: '吴忠', region: '宁夏', longitude: 106.199, tz: 8 },
    { id: 'guyuan', name: '固原', region: '宁夏', longitude: 106.243, tz: 8 },
    { id: 'zhongwei', name: '中卫', region: '宁夏', longitude: 105.197, tz: 8 },
    // 新疆
    { id: 'urumqi', name: '乌鲁木齐', region: '新疆', longitude: 87.617, tz: 8 },
    { id: 'kelamayi', name: '克拉玛依', region: '新疆', longitude: 84.874, tz: 8 },
    { id: 'kashi', name: '喀什', region: '新疆', longitude: 75.989, tz: 8 },
    { id: 'yining', name: '伊宁', region: '新疆', longitude: 81.325, tz: 8 },
    { id: 'korla', name: '库尔勒', region: '新疆', longitude: 86.145, tz: 8 },
    { id: 'akesu', name: '阿克苏', region: '新疆', longitude: 80.261, tz: 8 },
    { id: 'hetian', name: '和田', region: '新疆', longitude: 79.919, tz: 8 },
    { id: 'hami', name: '哈密', region: '新疆', longitude: 93.516, tz: 8 },
    { id: 'turpan', name: '吐鲁番', region: '新疆', longitude: 89.185, tz: 8 },
    { id: 'aletai', name: '阿勒泰', region: '新疆', longitude: 88.140, tz: 8 },
    { id: 'tacheng', name: '塔城', region: '新疆', longitude: 82.986, tz: 8 },
    { id: 'atushi', name: '阿图什', region: '新疆', longitude: 76.168, tz: 8 },
    { id: 'bole', name: '博乐', region: '新疆', longitude: 82.075, tz: 8 },
    { id: 'changji', name: '昌吉', region: '新疆', longitude: 87.308, tz: 8 },
    { id: 'shihezi', name: '石河子', region: '新疆', longitude: 86.041, tz: 8 },
    { id: 'kuitun', name: '奎屯', region: '新疆', longitude: 84.902, tz: 8 },
    // 内蒙古
    { id: 'hohhot', name: '呼和浩特', region: '内蒙古', longitude: 111.749, tz: 8 },
    { id: 'baotou', name: '包头', region: '内蒙古', longitude: 109.840, tz: 8 },
    { id: 'chifeng', name: '赤峰', region: '内蒙古', longitude: 118.894, tz: 8 },
    { id: 'eerduosi', name: '鄂尔多斯', region: '内蒙古', longitude: 109.995, tz: 8 },
    { id: 'tongliao', name: '通辽', region: '内蒙古', longitude: 122.263, tz: 8 },
    { id: 'hulunbeier', name: '海拉尔', region: '内蒙古', longitude: 119.766, tz: 8 },
    { id: 'bayannaoer', name: '巴彦淖尔', region: '内蒙古', longitude: 107.388, tz: 8 },
    { id: 'wulanchabu', name: '乌兰察布', region: '内蒙古', longitude: 113.133, tz: 8 },
    { id: 'xilingguole', name: '锡林浩特', region: '内蒙古', longitude: 116.050, tz: 8 },
    { id: 'xinganmeng', name: '乌兰浩特', region: '内蒙古', longitude: 122.070, tz: 8 },
    { id: 'alashan', name: '阿拉善', region: '内蒙古', longitude: 105.728, tz: 8 },
    { id: 'wuhai', name: '乌海', region: '内蒙古', longitude: 106.820, tz: 8 },
    // 广西
    { id: 'nanning', name: '南宁', region: '广西', longitude: 108.320, tz: 8 },
    { id: 'liuzhou', name: '柳州', region: '广西', longitude: 109.428, tz: 8 },
    { id: 'guilin', name: '桂林', region: '广西', longitude: 110.290, tz: 8 },
    { id: 'beihai', name: '北海', region: '广西', longitude: 109.120, tz: 8 },
    { id: 'fangchenggang', name: '防城港', region: '广西', longitude: 108.345, tz: 8 },
    { id: 'qinzhou', name: '钦州', region: '广西', longitude: 108.624, tz: 8 },
    { id: 'guigang', name: '贵港', region: '广西', longitude: 109.602, tz: 8 },
    { id: 'yulin-gx', name: '玉林', region: '广西', longitude: 110.154, tz: 8 },
    { id: 'baise', name: '百色', region: '广西', longitude: 106.618, tz: 8 },
    { id: 'hezhou', name: '贺州', region: '广西', longitude: 111.553, tz: 8 },
    { id: 'hechi', name: '河池', region: '广西', longitude: 108.063, tz: 8 },
    { id: 'laibin', name: '来宾', region: '广西', longitude: 109.232, tz: 8 },
    { id: 'chongzuo', name: '崇左', region: '广西', longitude: 107.364, tz: 8 },
    { id: 'wuzhou', name: '梧州', region: '广西', longitude: 111.279, tz: 8 },
    // 台湾
    { id: 'taipei', name: '台北', region: '台湾', longitude: 121.565, tz: 8 },
    { id: 'kaohsiung', name: '高雄', region: '台湾', longitude: 120.301, tz: 8 },
    { id: 'taichung', name: '台中', region: '台湾', longitude: 120.674, tz: 8 },
    { id: 'tainan', name: '台南', region: '台湾', longitude: 120.200, tz: 8 },
    { id: 'xinbei', name: '新北', region: '台湾', longitude: 121.466, tz: 8 },
    { id: 'taoyuan', name: '桃园', region: '台湾', longitude: 121.313, tz: 8 },
    { id: 'hsinchu', name: '新竹', region: '台湾', longitude: 120.969, tz: 8 },
    { id: 'keelung', name: '基隆', region: '台湾', longitude: 121.741, tz: 8 },
  ];

  const FOCUS = [
    { key: 'overall', label: '整体' },
    { key: 'career', label: '搞事业' },
    { key: 'wealth', label: '搞钱' },
    { key: 'relationship', label: '感情' },
    { key: 'wellbeing', label: '状态' },
  ];

  const FOCUS_ACTIONS = {
    overall: {
      lead: '把今年的重点收敛成一个可复盘的主线，每月只追踪一项关键进展。',
      caution: '遇到外部变化时先留出复核时间，再做不可逆的决定。',
      habit: '用一页记录持续观察：发生了什么、依据是什么、结果如何。',
    },
    career: {
      lead: '把能力沉淀为可展示的成果，优先争取有明确边界和反馈周期的任务。',
      caution: '重要承诺写清目标、资源与退出条件，避免只凭一时气势加码。',
      habit: '每周保留一个不被打扰的深度工作时段，形成可复用的方法。',
    },
    wealth: {
      lead: '先建立现金流和预算的可见性，再讨论扩张；把机会拆成小额可验证的试验。',
      caution: '不把命理提示当作投资依据，任何资金决定都应经过独立的风险评估。',
      habit: '固定记录收入、支出与风险敞口，让“感觉”回到可核对的数据上。',
    },
    relationship: {
      lead: '把关系中的期待说成具体请求，给彼此留下回应和调整的空间。',
      caution: '冲突期避免用单一标签解释对方，重要决定等情绪回落后再确认。',
      habit: '每周安排一次不带目的的交流，积累可被信任的日常。',
    },
    wellbeing: {
      lead: '优先稳住睡眠、饮食和运动这三个可控变量，再安排高强度目标。',
      caution: '传统命理不能替代医疗建议，任何不适应及时寻求专业帮助。',
      habit: '用可量化的轻量习惯记录精力变化，不追求一次性彻底改变。',
    },
  };

  const FOCUS_CONTEXT = {
    overall: {
      object: '年度主线', unit: '一项可在七天内验证的小行动',
      task: '从当前待办中只选一件最重要的事，今天写下完成标准，并在 7 天内做出第一个可交付版本。',
      subjectExample: '例如：完成作品集首页、整理家庭预算、恢复晨间散步',
      criterion: '第 7 天能展示一个真实结果，并至少记录一条外部反馈或客观变化。',
    },
    career: {
      object: '一个可展示、可验收的职业成果', unit: '一个能被他人检验的交付节点',
      task: '选一个正在推进的任务，今天写清交付物和截止日，并在 7 天内交出第一版。',
      subjectExample: '例如：完成作品集首页、交付项目第一版、准备一次述职',
      criterion: '第 7 天有一个可以给别人查看的版本，并收到至少一条真实反馈。',
    },
    wealth: {
      object: '现金流安全与机会验证', unit: '一笔有上限、可复盘的小额试验',
      task: '检查最近 7 天的收支，只选一项可调整支出或小额机会，先写明金额上限再行动。',
      subjectExample: '例如：控制外卖支出、评估一项副业、核对订阅费用',
      criterion: '第 7 天能用金额或记录说明：继续、停止，还是调整投入上限。',
    },
    relationship: {
      object: '一段最重要关系里的具体期待', unit: '一次说清请求与边界的对话',
      task: '选一段重要关系，约一次 20 分钟对话：只表达一个具体请求，并请对方复述理解。',
      subjectExample: '例如：和伴侣讨论家务分工、向同事说清协作边界',
      criterion: '对方能准确复述你的请求，双方确认一个下一步或明确暂不推进。',
    },
    wellbeing: {
      object: '睡眠、饮食或运动中的一个可控变量', unit: '一个连续七天可记录的轻量习惯',
      task: '从睡眠、饮食、运动中只选一项，设定一个最低标准，连续 7 天每天记录是否完成。',
      subjectExample: '例如：23:30 前上床、每天步行 20 分钟、减少夜宵',
      criterion: '7 天中至少 5 天达到最低标准，并记录精力、睡眠或身体感受的变化。',
    },
  };

  function experimentAction(focus, subject, execution) {
    const target = `“${subject}”`;
    const prefix = {
      overall: `本周要做：${target}。今天写清完成标准，7 天内做出一个能展示的版本。`,
      career: `本周要做：${target}。今天写清交付物和截止日，7 天内交出第一版。`,
      wealth: `本周要做：${target}。先写明金额上限和停止条件，连续 7 天记录真实收支或反馈。`,
      relationship: `本周要做：${target}。安排一次 20 分钟对话，只表达一个具体请求，并请对方复述理解。`,
      wellbeing: `本周要做：${target}。设定一个最低标准，连续 7 天记录是否完成和身体感受。`,
    };
    return `${prefix[focus] || prefix.overall}${execution || ''}`;
  }

  const TEN_GOD_EXECUTION = {
    self: '如果涉及他人，开始前先写清各自分工。',
    output: '不要继续准备，先做出一个能给别人看的版本。',
    wealth: '开始前写下投入上限和停止条件。',
    authority: '务必写清验收标准和截止时间。',
    resource: '准备时间最多 30 分钟，随后立即进入实践。',
    neutral: '完成后只记录事实，不急着下结论。',
  };

  const TEN_GOD_GUIDE = {
    self: {
      lead: '先明确谁负责、谁协作，再进入竞争或资源分配',
      risk: '避免被同伴比较或一时胜负带偏长期目标',
      metric: '记录一次协作中“承诺—交付—反馈”是否一致',
    },
    output: {
      lead: '把想法做成能被看见的表达、作品或验证样本',
      risk: '避免只追求表达速度，忽略规则、受众与收尾',
      metric: '每周完成一次公开输出，并记录真实反馈',
    },
    wealth: {
      lead: '把资源、报价和交换条件写清楚，再决定是否加码',
      risk: '避免把机会感等同于收益确定性',
      metric: '记录投入上限、退出条件和实际回报',
    },
    authority: {
      lead: '把责任拆成有期限、有标准的交付节点',
      risk: '避免在压力下接受边界模糊的责任或承诺',
      metric: '每周核对一次职责、进度与阻塞项',
    },
    resource: {
      lead: '先补方法、信息与恢复，再用系统化流程推进',
      risk: '避免长期准备却迟迟不进入真实验证',
      metric: '每学一项方法，就安排一次最小实践',
    },
    neutral: {
      lead: '用小步试验换取现实反馈，再决定下一步',
      risk: '避免把结构提示当成确定事件',
      metric: '记录假设、行动和结果三项事实',
    },
  };

  const PLAIN_IDENTITY = {
    self: '你更习惯自主推进，也会敏锐感受到同伴之间的分工与比较',
    output: '你更擅长把想法变成表达、作品或可被看见的成果',
    wealth: '你对资源、结果和交换条件较敏感，适合把机会拆开验证',
    authority: '你更容易在明确规则、责任和压力目标中找到推进方向',
    resource: '你更擅长先理解方法、吸收信息，再建立自己的稳定路径',
    neutral: '你适合先观察现实反馈，再逐步确定自己的推进方式',
  };

  const ARCHETYPE = {
    self: '自主的开路者',
    output: '把想法做成结果的人',
    wealth: '敏锐的资源经营者',
    authority: '高标准的推进者',
    resource: '系统型思考者',
    neutral: '稳步校准的实践者',
  };

  const STAGE_HEADLINE = {
    self: '选对同伴，也守住自己的主线',
    output: '让作品走到台前，用反馈继续打磨',
    wealth: '看清筹码，再决定是否加码',
    authority: '先收边界，再交付结果',
    resource: '把方法变成一次真实实践',
    neutral: '用小步反馈校准方向',
  };

  function pad(n) { return String(n).padStart(2, '0'); }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function isValidSolarDate(year, month, day, minYear = 1900, maxYear = 2100) {
    if (![year, month, day].every(Number.isInteger) || year < minYear || year > maxYear
      || month < 1 || month > 12 || day < 1) return false;
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= days[month - 1];
  }
  function parseTime(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    const hour = Number(match[1]), minute = Number(match[2]);
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? { hour, minute } : null;
  }
  function zhiIndexFromMinutes(total) {
    const minutes = ((total % 1440) + 1440) % 1440;
    return Math.floor((minutes / 60 + 1) / 2) % 12;
  }
  function formatClock(hour, minute) { return `${pad(hour)}:${pad(minute)}`; }
  function normalizeClock(total) {
    const value = ((Math.round(total) % 1440) + 1440) % 1440;
    return { hour: Math.floor(value / 60), minute: value % 60, total: value };
  }
  function circularDistance(a, b, cycle) {
    const d = Math.abs(a - b) % cycle;
    return Math.min(d, cycle - d);
  }
  function termDateValue(info) {
    if (!info || !info.date) return null;
    const d = info.date;
    return Date.UTC(d.y, d.m - 1, d.d, d.hour || 0, d.min || 0, d.sec || 0);
  }
  function buildAccuracy(chart, context = {}) {
    const input = chart && chart.input ? chart.input : {};
    const solar = chart && chart.solarInfo;
    const precision = context.timePrecision || 'exact';
    const exact = precision === 'exact';
    const correctionMinutes = solar ? Math.round((solar.lonDiff || 0) + (solar.eot || 0)) : 0;
    const corrected = solar ? normalizeClock(solar.totalMin) : normalizeClock((input.hour || 0) * 60 + (input.minute || 0));
    const rawTotal = (input.hour || 0) * 60 + (input.minute || 0);
    const rawZhi = zhiIndexFromMinutes(rawTotal);
    const correctedZhi = zhiIndexFromMinutes(corrected.total);
    const boundaryDistances = [];
    for (let h = 1; h <= 23; h += 2) boundaryDistances.push(circularDistance(corrected.total, h * 60, 1440));
    const boundaryMinutes = Math.min(...boundaryDistances);
    const warnings = [];
    if (!exact) warnings.push('只知道时辰：页面以该时辰中段估算，时柱附近结论应视为候选而非定论。');
    if (context.useTrueSolar && !context.cityConfirmed) warnings.push('出生地尚未确认：真太阳时仍按当前经度计算，建议选择城市或填写经度。');
    if (exact && boundaryMinutes <= 20) warnings.push(`真太阳时距时辰边界约 ${Math.round(boundaryMinutes)} 分钟，建议核对出生记录。`);
    if (exact && rawZhi !== correctedZhi) warnings.push(`真太阳时校正使时辰从「${ZHI[rawZhi]}」移到「${ZHI[correctedZhi]}」，请确认出生地与时区。`);
    if (solar && solar.dayShift) warnings.push('真太阳时跨越了公历日界，日柱按校正后的日期计算。');
    const birthValue = Date.UTC(input.year, (input.month || 1) - 1, input.day || 1, input.hour || 0, input.minute || 0);
    const termValues = [termDateValue(chart.jieInfo && chart.jieInfo.prev), termDateValue(chart.jieInfo && chart.jieInfo.current), termDateValue(chart.jieInfo && chart.jieInfo.next)].filter(Number.isFinite);
    const termMinutes = termValues.length ? Math.min(...termValues.map(v => Math.abs(v - birthValue) / 60000)) : Infinity;
    if (termMinutes <= 120) warnings.push(`出生时刻距离节气切换约 ${Math.round(termMinutes)} 分钟，月柱可能处于流派临界。`);
    let grade = '高';
    let gradeClass = 'high';
    if (!exact || (context.useTrueSolar && !context.cityConfirmed)) { grade = '中'; gradeClass = 'medium'; }
    if (warnings.some(w => /边界|移到|跨越|切换/.test(w))) { grade = '需复核'; gradeClass = 'review'; }
    return {
      version: VERSION,
      grade,
      gradeClass,
      precisionLabel: exact ? '精确到分钟' : '时辰中位估算',
      correctedLabel: formatClock(corrected.hour, corrected.minute),
      correctionMinutes,
      rawZhi: ZHI[rawZhi],
      correctedZhi: ZHI[correctedZhi],
      boundaryMinutes: Math.round(boundaryMinutes),
      termMinutes: Number.isFinite(termMinutes) ? Math.round(termMinutes) : null,
      warnings,
      localOnly: true,
    };
  }

  function currentRun(chart, now = new Date()) {
    const runs = chart && chart.dayun && chart.dayun.runs;
    if (!runs || !runs.length) return null;
    const nowValue = now.getTime();
    let active = null;
    runs.forEach((run, idx) => {
      const start = Date.UTC(run.startYear, (run.startMonth || 1) - 1, run.startDay || 1);
      const next = runs[idx + 1]
        ? Date.UTC(runs[idx + 1].startYear, (runs[idx + 1].startMonth || 1) - 1, runs[idx + 1].startDay || 1)
        : Infinity;
      if (nowValue >= start && nowValue < next) active = run;
    });
    return active;
  }

  function tenGodFamily(name) {
    const value = String(name || '');
    if (/比肩|劫财/.test(value)) return 'self';
    if (/食神|伤官/.test(value)) return 'output';
    if (/正财|偏财/.test(value)) return 'wealth';
    if (/正官|七杀/.test(value)) return 'authority';
    if (/正印|偏印/.test(value)) return 'resource';
    return 'neutral';
  }

  function strengthAdvice(strength) {
    const level = String(strength && strength.level || '');
    if (/身弱/.test(level)) return '盘面偏弱，单次只推进一个重点，先确认时间、资源和恢复余量。';
    if (/身强/.test(level)) return '盘面偏强，主动设置截止时间和外部反馈，避免只凭惯性推进。';
    if (/从/.test(level)) return '盘面有从势特征，顺着已有资源验证，但保留清晰退出条件。';
    return '强弱信号居中，用七天小试验比一次性押注更稳妥。';
  }

  function relationSummary(chart, year) {
    const current = year && Array.isArray(year.relWithDayZhi) ? year.relWithDayZhi : [];
    const natal = chart && Array.isArray(chart.relations)
      ? chart.relations.flatMap(item => Array.isArray(item.type) ? item.type : []) : [];
    const all = Array.from(new Set(current.concat(natal))).slice(0, 3);
    return all.length ? all.join('、') : '';
  }

  function plainIdentity(pattern, strength) {
    const base = PLAIN_IDENTITY[tenGodFamily(pattern && pattern.primary)] || PLAIN_IDENTITY.neutral;
    const level = String(strength && strength.level || '');
    if (/身弱/.test(level)) return `${base}；眼下更适合缩小承诺，先确认时间、资源和恢复余量`;
    if (/身强/.test(level)) return `${base}；眼下要主动设置截止与反馈，避免只凭惯性加速`;
    if (/从/.test(level)) return `${base}；眼下可以顺着已有资源推进，同时保留退出条件`;
    return `${base}；眼下用七天小试验换取反馈，比一次性押注更稳妥`;
  }

  function buildInsights(chart, focus = 'overall', now = new Date()) {
    const safeFocus = FOCUS_ACTIONS[focus] ? focus : 'overall';
    const day = chart && chart.dayMaster ? chart.dayMaster : { gan: '—', wuxing: '—', yinyang: '' };
    const useGod = chart && chart.useGod ? chart.useGod : { xi: [], ji: [] };
    const pattern = chart && chart.pattern ? chart.pattern : { gridName: '待定' };
    const strength = chart && chart.strength ? chart.strength : { level: '待定' };
    const year = (chart && chart.liunian || []).find(n => n.isCurrent) || (chart && chart.liunian || [])[0];
    const run = currentRun(chart, now);
    const action = FOCUS_ACTIONS[safeFocus];
    const focusContext = FOCUS_CONTEXT[safeFocus];
    const yearGanWx = year ? GAN_WX[year.gan] : '';
    const yearZhiWx = year ? ZHI_WX[year.zhi] : '';
    const xiHit = year && useGod.xi && (useGod.xi.includes(yearGanWx) || useGod.xi.includes(yearZhiWx));
    const jiHit = year && useGod.ji && (useGod.ji.includes(yearGanWx) || useGod.ji.includes(yearZhiWx));
    const signal = xiHit && !jiHit ? '顺势' : (jiHit && !xiHit ? '审慎' : '平衡');
    const theme = year && year.tenGod ? year.tenGod : '本命结构';
    const themeFamily = tenGodFamily(theme);
    const yearGuide = TEN_GOD_GUIDE[themeFamily];
    const execution = TEN_GOD_EXECUTION[tenGodFamily(theme)] || TEN_GOD_EXECUTION.neutral;
    const runTheme = run ? (run.ganTenGod || run.zhiTenGod || '阶段主题') : '起运前阶段';
    const runGuide = TEN_GOD_GUIDE[tenGodFamily(runTheme)];
    const relations = relationSummary(chart, year);
    const strengthLine = strengthAdvice(strength);
    const signalLine = jiHit && !xiHit
      ? `流年五行与忌神相交，先给${focusContext.object}设置投入上限和退出条件。`
      : (xiHit && !jiHit
        ? `流年五行与喜用相交，可以主动推进，但仍要用现实反馈校准。`
        : `流年喜忌信号混合，适合先做${focusContext.unit}。`);
    const evidence = [
      `日主 ${day.gan}${day.wuxing}${day.yinyang || ''}`,
      `${pattern.gridName || '格局待定'} · ${strength.level || '强弱待定'}`,
      useGod.xi && useGod.xi.length ? `喜用 ${useGod.xi.join('、')} · 流年${signal}` : `喜用待定 · 流年${signal}`,
    ];
    const actions = [
      {
        label: '现在做',
        text: `${focusContext.task}${execution}`,
        evidence: `${year ? `${year.year}年${year.name}` : '当前年份'}以「${theme}」为表层主题；${run ? `${run.name}大运` : '起运前'}以「${runTheme}」为阶段背景。`,
      },
      {
        label: '守住边界',
        text: `${signalLine}${relations ? ` 同时留意盘面中的${relations}关系信号。` : ''}`,
        evidence: `${strengthLine}${relations ? ` 关系结构检出：${relations}；它只描述互动倾向，不等于事件必然发生。` : ''}`,
      },
      {
        label: '如何验证',
        text: `${runGuide.metric}；${action.habit}`,
        evidence: `大运「${runTheme}」与流年「${theme}」共同决定观察角度；若连续四周没有现实证据，应降低这条建议的权重。`,
      },
    ];
    const experiment = {
      subjectExample: focusContext.subjectExample,
      criterion: focusContext.criterion,
      strategy: execution,
      boundary: actions[1].text,
      metric: actions[2].text,
      evidence: actions[0].evidence,
    };
    return {
      focus: safeFocus,
      focusLabel: (FOCUS.find(f => f.key === safeFocus) || FOCUS[0]).label,
      archetype: ARCHETYPE[tenGodFamily(pattern && pattern.primary)] || ARCHETYPE.neutral,
      stageHeadline: STAGE_HEADLINE[themeFamily] || STAGE_HEADLINE.neutral,
      opportunity: action.lead,
      risk: action.caution,
      headline: plainIdentity(pattern, strength),
      technicalHeadline: `${day.gan}${day.wuxing}日主 · ${pattern.gridName || '格局待定'} · ${strength.level || '强弱待定'}`,
      subhead: year ? `${year.year} 年观察：${yearGuide.lead}；当前节奏以“${signal}”为宜。` : '当前年份信号待定，先以现实反馈为准。',
      year,
      run,
      evidence,
      actions,
      experiment,
      disclaimer: '这是基于命盘结构的年度观察清单，不是事件预言；请用现实信息验证每一步。',
    };
  }

  function composeExperiment(insights, subject) {
    const cleanSubject = String(subject || '').trim().slice(0, 60);
    if (!insights || !cleanSubject) return null;
    const experiment = insights.experiment || {};
    return {
      subject: cleanSubject,
      action: experimentAction(insights.focus || 'overall', cleanSubject, experiment.strategy),
      criterion: experiment.criterion || '第 7 天能记录一个客观结果，并据此决定保留、调整或放弃。',
      strategy: experiment.strategy || '',
      boundary: experiment.boundary || '',
      metric: experiment.metric || '',
      evidence: experiment.evidence || '',
    };
  }

  function normalizeInput(input) {
    const src = input || {};
    const out = {
      name: String(src.name || '').trim().slice(0, 30),
      gender: src.gender === 'female' ? 'female' : 'male',
      calendar: src.calendar === 'lunar' ? 'lunar' : 'solar',
      year: Number(src.year), month: Number(src.month), day: Number(src.day),
      lunarLeap: Boolean(src.lunarLeap),
      hour: Number(src.hour), minute: Number(src.minute),
      timePrecision: src.timePrecision === 'shichen' ? 'shichen' : 'exact',
      shiIdx: Number.isInteger(Number(src.shiIdx)) ? Number(src.shiIdx) : 8,
      longitude: Number(src.longitude), tz: Number(src.tz),
      useTrueSolar: src.useTrueSolar !== false,
      ziDayRule: src.ziDayRule === 'same' ? 'same' : 'next',
      cityId: String(src.cityId || ''), cityName: String(src.cityName || ''),
      focus: FOCUS_ACTIONS[src.focus] ? src.focus : 'overall',
      lunarLabel: String(src.lunarLabel || '').slice(0, 60),
      shiName: String(src.shiName || '').slice(0, 10),
    };
    if (!Number.isFinite(out.longitude)) out.longitude = 120;
    if (!Number.isFinite(out.tz)) out.tz = 8;
    if (!Number.isFinite(out.hour)) out.hour = 12;
    if (!Number.isFinite(out.minute)) out.minute = 0;
    return out;
  }
  function validProfileInput(input) {
    const p = normalizeInput(input);
    if (p.calendar === 'solar' && !isValidSolarDate(p.year, p.month, p.day)) return false;
    if (p.calendar === 'lunar' && (p.year < 1900 || p.year > 2100 || p.month < 1 || p.month > 12 || p.day < 1 || p.day > 30)) return false;
    return p.hour >= 0 && p.hour <= 23 && p.minute >= 0 && p.minute <= 59
      && p.longitude >= -180 && p.longitude <= 180 && p.tz >= -12 && p.tz <= 14;
  }
  function profileSignature(input) {
    const p = normalizeInput(input);
    return [p.name, p.gender, p.calendar, p.year, p.month, p.day, p.lunarLeap, p.hour, p.minute, p.timePrecision, p.shiIdx, p.longitude, p.tz, p.useTrueSolar, p.ziDayRule].join('|');
  }
  function readProfiles(storage) {
    try {
      const raw = storage && storage.getItem(PROFILE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter(p => p && p.input && validProfileInput(p.input)).slice(0, PROFILE_LIMIT) : [];
    } catch (_) { return []; }
  }
  function writeProfiles(storage, list) {
    if (!storage) return false;
    try { storage.setItem(PROFILE_KEY, JSON.stringify(list.slice(0, PROFILE_LIMIT))); return true; } catch (_) { return false; }
  }
  function saveProfile(storage, input, label) {
    const p = normalizeInput(input);
    if (!validProfileInput(p)) return null;
    const list = readProfiles(storage);
    const signature = profileSignature(p);
    const now = new Date().toISOString();
    const found = list.find(item => item.signature === signature);
    const profile = found || { id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: now };
    profile.input = p;
    profile.signature = signature;
    profile.label = String(label || p.name || '未署名命主').trim().slice(0, 30);
    profile.updatedAt = now;
    const next = [profile, ...list.filter(item => item.id !== profile.id)];
    return writeProfiles(storage, next) ? profile : null;
  }
  function importProfilesAtomic(storage, entries) {
    if (!Array.isArray(entries) || !entries.length) return { profiles: [], total: readProfiles(storage).length };
    const candidates = entries.slice(0, PROFILE_LIMIT).map((entry, index) => {
      const input = entry && entry.input ? entry.input : entry;
      if (!validProfileInput(input)) throw new Error(`第 ${index + 1} 条档案字段无效`);
      return { input: normalizeInput(input), label: String(entry && entry.label || input.name || '未署名命主').trim().slice(0, 30) };
    });
    let next = readProfiles(storage).map(profile => Object.assign({}, profile));
    const imported = [];
    const now = new Date().toISOString();
    candidates.forEach((candidate, index) => {
      const signature = profileSignature(candidate.input);
      const found = next.find(item => item.signature === signature);
      const profile = found ? Object.assign({}, found) : {
        id: `p_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: now,
      };
      profile.input = candidate.input;
      profile.signature = signature;
      profile.label = candidate.label;
      profile.updatedAt = now;
      next = [profile, ...next.filter(item => item.id !== profile.id)].slice(0, PROFILE_LIMIT);
      imported.push(profile);
    });
    if (!writeProfiles(storage, next)) throw new Error('浏览器存储写入失败');
    return { profiles: imported, total: next.length };
  }
  function removeProfile(storage, id) {
    const list = readProfiles(storage).filter(item => item.id !== id);
    return writeProfiles(storage, list);
  }
  function clearProfiles(storage) { return writeProfiles(storage, []); }
  function shareUrl(value) {
    try {
      const url = new URL(String(value || ''));
      if (!/^https?:$/.test(url.protocol)) return '';
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch (_) { return ''; }
  }
  function shareText(chart, insights, url) {
    if (!chart || !chart.pillars) return '';
    const target = shareUrl(url);
    const lines = [
      '天枢 · 我的命盘报告',
      insights ? insights.headline : '',
      insights ? insights.subhead : '',
      insights && insights.actions[0] ? `现在做：${insights.actions[0].text}` : '',
      '已隐藏姓名、出生日期、时间、地点与完整四柱',
      '本地计算 · 传统文化参考，不作确定性预言',
      target ? `测同款：${target}` : '',
    ];
    return lines.filter(Boolean).join('\n');
  }

  return {
    VERSION, PROFILE_KEY, CITIES, FOCUS,
    escapeHtml, isValidSolarDate, parseTime, zhiIndexFromMinutes, formatClock,
    buildAccuracy, buildInsights, composeExperiment, normalizeInput, validProfileInput, profileSignature,
    readProfiles, saveProfile, importProfilesAtomic, removeProfile, clearProfiles, shareUrl, shareText,
  };
});
