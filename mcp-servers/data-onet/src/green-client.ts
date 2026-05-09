/**
 * O*NET Green Economy Classifications Client
 *
 * 204 green occupations classified into three tiers:
 *   - Enhanced Green Skills (62): existing occupations where green activities change skill requirements
 *   - Increased Demand (64): existing occupations where green economy increases hiring volume
 *   - New & Emerging (78): entirely new green occupations
 *
 * Source: https://www.onetcenter.org/dictionary/22.0/excel/ — CC-BY 4.0
 * Data is hardcoded because it is a small, stable, public dataset.
 */

export type GreenCategory = 'enhanced_skills' | 'increased_demand' | 'new_emerging';

export interface GreenOccupation {
  code: string;
  title: string;
  category: GreenCategory;
  category_label: string;
  green_skills: string[];
  green_tasks: string[];
  data_source: 'onet_green';
}

export interface GreenSkill {
  name: string;
  description: string;
  occupation_codes: string[];
  category: GreenCategory;
  data_source: 'onet_green';
}

const CATEGORY_LABELS: Record<GreenCategory, string> = {
  enhanced_skills: 'Enhanced Green Skills',
  increased_demand: 'Increased Demand',
  new_emerging: 'New & Emerging',
};

// ---------------------------------------------------------------------------
// Hardcoded green occupation data — representative subset of 204 occupations
// ---------------------------------------------------------------------------

const GREEN_OCCUPATIONS: GreenOccupation[] = [
  // =========================================================================
  // ENHANCED GREEN SKILLS (62 total — 20 representative occupations)
  // Existing occupations where green economy activities change skill needs
  // =========================================================================
  {
    code: '11-9021.00',
    title: 'Construction Managers',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Green building design', 'LEED certification knowledge', 'Sustainable materials selection', 'Energy-efficient construction methods'],
    green_tasks: ['Implement green building practices in construction projects', 'Ensure compliance with environmental building codes', 'Select sustainable and recycled building materials', 'Monitor energy performance of building systems'],
    data_source: 'onet_green',
  },
  {
    code: '17-2051.00',
    title: 'Civil Engineers',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Sustainable infrastructure design', 'Stormwater management', 'Environmental impact assessment', 'Green infrastructure planning'],
    green_tasks: ['Design infrastructure with environmental sustainability considerations', 'Develop stormwater management systems using green infrastructure', 'Conduct environmental impact assessments for construction projects', 'Plan transportation systems to reduce carbon emissions'],
    data_source: 'onet_green',
  },
  {
    code: '17-2071.00',
    title: 'Electrical Engineers',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Renewable energy systems design', 'Smart grid technology', 'Energy storage systems', 'Power electronics for clean energy'],
    green_tasks: ['Design electrical systems for renewable energy installations', 'Develop smart grid components for efficient energy distribution', 'Engineer energy storage solutions for intermittent power sources', 'Optimize power conversion systems for solar and wind installations'],
    data_source: 'onet_green',
  },
  {
    code: '17-2141.00',
    title: 'Mechanical Engineers',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Energy-efficient HVAC design', 'Sustainable product design', 'Lifecycle assessment', 'Emissions reduction engineering'],
    green_tasks: ['Design energy-efficient mechanical systems for buildings', 'Develop products with reduced environmental footprint', 'Conduct lifecycle assessments of mechanical components', 'Engineer systems to reduce greenhouse gas emissions'],
    data_source: 'onet_green',
  },
  {
    code: '17-1011.00',
    title: 'Architects, Except Landscape and Naval',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Green building design', 'Passive solar design', 'LEED and BREEAM standards', 'Net-zero energy building design'],
    green_tasks: ['Design buildings to meet green certification standards', 'Incorporate passive solar heating and natural ventilation', 'Specify sustainable and locally sourced building materials', 'Design net-zero energy buildings'],
    data_source: 'onet_green',
  },
  {
    code: '19-2041.00',
    title: 'Environmental Scientists and Specialists, Including Health',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Carbon footprint analysis', 'Climate change modeling', 'Environmental remediation', 'Sustainability reporting'],
    green_tasks: ['Conduct environmental impact studies for green energy projects', 'Develop carbon reduction strategies for organizations', 'Monitor and report on environmental compliance metrics', 'Advise on climate adaptation and mitigation strategies'],
    data_source: 'onet_green',
  },
  {
    code: '47-2111.00',
    title: 'Electricians',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Solar PV installation wiring', 'EV charging station installation', 'Energy-efficient lighting systems', 'Smart home energy management'],
    green_tasks: ['Install and wire solar photovoltaic systems', 'Set up electric vehicle charging stations', 'Retrofit buildings with energy-efficient lighting', 'Install smart energy management and monitoring systems'],
    data_source: 'onet_green',
  },
  {
    code: '11-1021.00',
    title: 'General and Operations Managers',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Corporate sustainability strategy', 'Environmental management systems', 'ESG reporting', 'Green supply chain management'],
    green_tasks: ['Develop and implement corporate sustainability programs', 'Oversee environmental management system compliance', 'Report on environmental, social, and governance metrics', 'Manage green procurement and supply chain initiatives'],
    data_source: 'onet_green',
  },
  {
    code: '13-1041.00',
    title: 'Compliance Officers',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Environmental regulatory compliance', 'Emissions trading knowledge', 'Environmental auditing', 'Green certification standards'],
    green_tasks: ['Ensure compliance with environmental regulations and permits', 'Manage carbon credit and emissions trading programs', 'Conduct environmental compliance audits', 'Develop environmental policies and procedures'],
    data_source: 'onet_green',
  },
  {
    code: '17-2081.00',
    title: 'Environmental Engineers',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Water treatment technology', 'Air quality management', 'Waste-to-energy systems', 'Brownfield remediation'],
    green_tasks: ['Design pollution control systems and equipment', 'Develop waste management and recycling systems', 'Engineer water treatment and purification systems', 'Plan environmental remediation of contaminated sites'],
    data_source: 'onet_green',
  },
  {
    code: '19-1031.00',
    title: 'Conservation Scientists',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Ecosystem management', 'Carbon sequestration', 'Biodiversity assessment', 'Sustainable forestry'],
    green_tasks: ['Manage natural resources to maximize carbon sequestration', 'Develop conservation plans for endangered ecosystems', 'Assess biodiversity impacts of land use changes', 'Implement sustainable forestry and land management practices'],
    data_source: 'onet_green',
  },
  {
    code: '11-3051.00',
    title: 'Industrial Production Managers',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Lean and green manufacturing', 'Waste reduction strategies', 'Energy management in manufacturing', 'Circular economy principles'],
    green_tasks: ['Implement lean manufacturing processes to reduce waste', 'Manage energy consumption in production facilities', 'Develop recycling and material reuse programs', 'Transition production lines to sustainable materials'],
    data_source: 'onet_green',
  },
  {
    code: '15-2051.00',
    title: 'Data Scientists',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Climate data analytics', 'Energy consumption modeling', 'Environmental data visualization', 'Sustainability metrics analysis'],
    green_tasks: ['Analyze climate and environmental datasets for trend identification', 'Model energy consumption patterns to identify efficiency opportunities', 'Develop dashboards for sustainability KPI tracking', 'Apply machine learning to optimize resource usage'],
    data_source: 'onet_green',
  },
  {
    code: '17-2112.00',
    title: 'Industrial Engineers',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Green process optimization', 'Waste stream analysis', 'Energy efficiency auditing', 'Sustainable supply chain design'],
    green_tasks: ['Optimize manufacturing processes to minimize environmental impact', 'Conduct energy audits of industrial facilities', 'Design supply chains with reduced carbon footprint', 'Implement waste reduction and recycling systems in factories'],
    data_source: 'onet_green',
  },
  {
    code: '13-2011.00',
    title: 'Accountants and Auditors',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Carbon accounting', 'Environmental cost analysis', 'Sustainability reporting standards', 'Green bond auditing'],
    green_tasks: ['Prepare carbon emissions reports and inventories', 'Audit environmental claims and sustainability reports', 'Apply environmental accounting standards to financial statements', 'Evaluate financial risks from climate change and environmental regulation'],
    data_source: 'onet_green',
  },
  {
    code: '41-4011.00',
    title: 'Sales Representatives, Wholesale and Manufacturing, Technical and Scientific Products',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Green product knowledge', 'Energy efficiency sales', 'Sustainability value propositions', 'Environmental certification expertise'],
    green_tasks: ['Sell energy-efficient and environmentally friendly products', 'Educate customers on sustainability benefits and ROI', 'Demonstrate green product features and certifications', 'Develop market strategies for clean technology products'],
    data_source: 'onet_green',
  },
  {
    code: '17-1012.00',
    title: 'Landscape Architects',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Green infrastructure design', 'Native plant landscaping', 'Stormwater bioretention', 'Urban heat island mitigation'],
    green_tasks: ['Design landscapes using native and drought-resistant plants', 'Plan green infrastructure for stormwater management', 'Create urban designs that mitigate heat island effects', 'Develop landscape plans that enhance biodiversity'],
    data_source: 'onet_green',
  },
  {
    code: '19-2043.00',
    title: 'Hydrologists',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Water resource sustainability', 'Watershed management', 'Groundwater remediation', 'Climate impact on water systems'],
    green_tasks: ['Assess impacts of climate change on water resources', 'Develop sustainable water management strategies', 'Monitor and remediate groundwater contamination', 'Model watershed systems for environmental planning'],
    data_source: 'onet_green',
  },
  {
    code: '25-1053.00',
    title: 'Environmental Science Teachers, Postsecondary',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Sustainability curriculum development', 'Environmental education methods', 'Climate science pedagogy', 'Green career pathway guidance'],
    green_tasks: ['Develop and teach courses on environmental sustainability', 'Conduct research on environmental science topics', 'Mentor students pursuing careers in green economy sectors', 'Integrate sustainability concepts across academic programs'],
    data_source: 'onet_green',
  },
  {
    code: '53-7081.00',
    title: 'Refuse and Recyclable Material Collectors',
    category: 'enhanced_skills',
    category_label: 'Enhanced Green Skills',
    green_skills: ['Waste stream sorting', 'Hazardous material identification', 'Recycling contamination prevention', 'Composting procedures'],
    green_tasks: ['Sort and process recyclable materials according to specifications', 'Identify and handle hazardous waste materials safely', 'Operate recycling collection and sorting equipment', 'Educate community members on proper recycling practices'],
    data_source: 'onet_green',
  },

  // =========================================================================
  // INCREASED DEMAND (64 total — 20 representative occupations)
  // Existing occupations where the green economy increases hiring volume
  // =========================================================================
  {
    code: '47-1011.00',
    title: 'First-Line Supervisors of Construction Trades and Extraction Workers',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Green construction supervision', 'Renewable energy project management', 'Environmental safety compliance'],
    green_tasks: ['Supervise construction of renewable energy facilities', 'Coordinate green building construction activities', 'Ensure environmental compliance on construction sites'],
    data_source: 'onet_green',
  },
  {
    code: '47-2031.00',
    title: 'Carpenters',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Sustainable materials framing', 'Energy-efficient window installation', 'Weatherization carpentry'],
    green_tasks: ['Install energy-efficient windows and doors', 'Frame structures using sustainably sourced lumber', 'Perform weatherization carpentry work on buildings'],
    data_source: 'onet_green',
  },
  {
    code: '49-9021.00',
    title: 'Heating, Air Conditioning, and Refrigeration Mechanics and Installers',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Heat pump technology', 'Refrigerant management', 'Energy-efficient HVAC systems', 'Geothermal heating systems'],
    green_tasks: ['Install and maintain high-efficiency HVAC systems', 'Service heat pump and geothermal heating equipment', 'Manage refrigerant recovery and recycling', 'Retrofit older systems with energy-efficient equipment'],
    data_source: 'onet_green',
  },
  {
    code: '51-8013.00',
    title: 'Power Plant Operators',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Renewable power generation', 'Grid integration for renewables', 'Emissions monitoring', 'Clean energy plant operations'],
    green_tasks: ['Operate renewable energy power generation equipment', 'Monitor and control emissions from power generation', 'Integrate renewable energy sources into power grid operations', 'Maintain biomass and waste-to-energy generation systems'],
    data_source: 'onet_green',
  },
  {
    code: '13-1199.00',
    title: 'Business Operations Specialists, All Other',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Sustainability program management', 'Carbon offset procurement', 'Green business development'],
    green_tasks: ['Manage corporate sustainability and environmental programs', 'Coordinate carbon offset and renewable energy credit purchases', 'Develop green business strategies and market opportunities'],
    data_source: 'onet_green',
  },
  {
    code: '47-2152.00',
    title: 'Plumbers, Pipefitters, and Steamfitters',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Solar thermal installation', 'Greywater recycling systems', 'Water conservation plumbing', 'Radiant heating systems'],
    green_tasks: ['Install solar thermal hot water systems', 'Set up greywater recycling and rainwater harvesting systems', 'Install water-conserving plumbing fixtures and systems', 'Construct radiant floor heating systems'],
    data_source: 'onet_green',
  },
  {
    code: '47-2073.00',
    title: 'Operating Engineers and Other Construction Equipment Operators',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Wind farm construction equipment', 'Solar field grading', 'Environmental site preparation'],
    green_tasks: ['Operate heavy equipment for wind farm construction', 'Grade and prepare land for solar installation fields', 'Perform environmental site preparation for green projects'],
    data_source: 'onet_green',
  },
  {
    code: '49-9041.00',
    title: 'Industrial Machinery Mechanics',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Wind turbine maintenance', 'Biomass processing equipment', 'Renewable energy machinery repair'],
    green_tasks: ['Maintain and repair wind turbine mechanical components', 'Service biomass and biofuel processing machinery', 'Troubleshoot renewable energy production equipment'],
    data_source: 'onet_green',
  },
  {
    code: '51-8031.00',
    title: 'Water and Wastewater Treatment Plant and System Operators',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Advanced water treatment', 'Energy recovery from wastewater', 'Biosolids management', 'Water reuse systems'],
    green_tasks: ['Operate advanced water and wastewater treatment systems', 'Manage energy recovery processes from wastewater', 'Operate water reclamation and reuse systems', 'Monitor biosolids processing for beneficial reuse'],
    data_source: 'onet_green',
  },
  {
    code: '47-2061.00',
    title: 'Construction Laborers',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Green demolition practices', 'Recycled material handling', 'Solar panel mounting'],
    green_tasks: ['Assist with installation of solar panels and renewable energy systems', 'Handle and sort construction materials for recycling', 'Perform green demolition and deconstruction activities'],
    data_source: 'onet_green',
  },
  {
    code: '17-3023.00',
    title: 'Electrical and Electronic Engineering Technologists and Technicians',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Solar system testing', 'Wind turbine electrical systems', 'Battery storage technology'],
    green_tasks: ['Test and calibrate electrical components of renewable energy systems', 'Maintain wind turbine electrical and control systems', 'Install and test battery energy storage systems'],
    data_source: 'onet_green',
  },
  {
    code: '49-9051.00',
    title: 'Electrical Power-Line Installers and Repairers',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Distributed generation interconnection', 'Smart grid infrastructure', 'Renewable energy grid connection'],
    green_tasks: ['Connect distributed renewable energy systems to power grid', 'Install and maintain smart grid infrastructure', 'Upgrade transmission lines for renewable energy capacity'],
    data_source: 'onet_green',
  },
  {
    code: '51-9199.00',
    title: 'Production Workers, All Other',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Solar panel manufacturing', 'Wind turbine component production', 'Green product assembly'],
    green_tasks: ['Manufacture solar panels and photovoltaic components', 'Assemble wind turbine components in production facilities', 'Produce green building materials and products'],
    data_source: 'onet_green',
  },
  {
    code: '11-9199.00',
    title: 'Managers, All Other',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Renewable energy project management', 'Environmental program management', 'Green operations management'],
    green_tasks: ['Manage renewable energy facility operations', 'Oversee environmental programs and initiatives', 'Coordinate green building and construction projects'],
    data_source: 'onet_green',
  },
  {
    code: '13-1161.00',
    title: 'Market Research Analysts and Marketing Specialists',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Green market analysis', 'Sustainability marketing', 'Clean technology market research'],
    green_tasks: ['Research market trends for green products and services', 'Analyze consumer demand for sustainable products', 'Develop marketing strategies for clean technology companies'],
    data_source: 'onet_green',
  },
  {
    code: '47-2211.00',
    title: 'Sheet Metal Workers',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Solar panel mounting fabrication', 'Energy-efficient ductwork', 'Green building envelope systems'],
    green_tasks: ['Fabricate and install solar panel mounting systems', 'Install energy-efficient HVAC ductwork', 'Construct green building envelope and roofing systems'],
    data_source: 'onet_green',
  },
  {
    code: '47-2221.00',
    title: 'Structural Iron and Steel Workers',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Wind turbine tower erection', 'Solar array structural support', 'Green building steel framing'],
    green_tasks: ['Erect structural steel for wind turbine towers', 'Install structural supports for large solar arrays', 'Construct steel framing for green commercial buildings'],
    data_source: 'onet_green',
  },
  {
    code: '51-4121.00',
    title: 'Welders, Cutters, Solderers, and Brazers',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Wind turbine welding', 'Solar thermal system welding', 'Pipeline welding for biofuels'],
    green_tasks: ['Weld components for wind turbine manufacturing', 'Join pipes and components for solar thermal systems', 'Fabricate welded structures for renewable energy facilities'],
    data_source: 'onet_green',
  },
  {
    code: '53-7062.00',
    title: 'Laborers and Freight, Stock, and Material Movers, Hand',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Recycling facility operations', 'Hazardous waste handling', 'Green material logistics'],
    green_tasks: ['Sort and move materials in recycling facilities', 'Handle materials for renewable energy equipment installation', 'Process and move waste materials for recycling and reuse'],
    data_source: 'onet_green',
  },
  {
    code: '17-3031.00',
    title: 'Surveying and Mapping Technicians',
    category: 'increased_demand',
    category_label: 'Increased Demand',
    green_skills: ['Wind resource assessment surveying', 'Solar site evaluation', 'Environmental impact surveying'],
    green_tasks: ['Survey sites for wind and solar energy development', 'Map terrain for renewable energy facility placement', 'Conduct environmental surveys for green construction projects'],
    data_source: 'onet_green',
  },

  // =========================================================================
  // NEW & EMERGING (78 total — 20 representative occupations)
  // Entirely new green occupations created by the green economy
  // =========================================================================
  {
    code: '47-4099.03',
    title: 'Weatherization Installers and Technicians',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Building envelope sealing', 'Insulation installation', 'Energy auditing', 'Blower door testing'],
    green_tasks: ['Install weatherization materials such as insulation and weather stripping', 'Conduct blower door tests to identify air leaks', 'Perform energy audits of residential and commercial buildings', 'Seal building envelopes to improve energy efficiency'],
    data_source: 'onet_green',
  },
  {
    code: '11-9199.09',
    title: 'Wind Energy Operations Managers',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Wind farm management', 'Turbine fleet optimization', 'Wind resource assessment', 'Power purchase agreement management'],
    green_tasks: ['Manage daily operations of wind energy facilities', 'Optimize wind turbine performance and availability', 'Coordinate maintenance schedules for wind turbine fleets', 'Negotiate and manage power purchase agreements'],
    data_source: 'onet_green',
  },
  {
    code: '17-2199.10',
    title: 'Wind Energy Engineers',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Wind turbine design', 'Aerodynamics modeling', 'Wind resource analysis', 'Turbine structural engineering'],
    green_tasks: ['Design wind turbine components and systems', 'Analyze wind resource data for site selection', 'Model aerodynamic performance of turbine blades', 'Develop wind farm layouts to maximize energy production'],
    data_source: 'onet_green',
  },
  {
    code: '47-2231.00',
    title: 'Solar Photovoltaic Installers',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['PV system design', 'Solar panel mounting', 'Inverter installation', 'Electrical code compliance for solar'],
    green_tasks: ['Install solar photovoltaic systems on rooftops and ground mounts', 'Connect PV systems to electrical grids', 'Configure and install solar inverters and charge controllers', 'Ensure solar installations meet electrical code requirements'],
    data_source: 'onet_green',
  },
  {
    code: '11-9199.11',
    title: 'Biofuels Production Managers',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Biofuel process management', 'Feedstock procurement', 'Biorefinery operations', 'Biofuel quality control'],
    green_tasks: ['Manage biofuel production facility operations', 'Oversee feedstock procurement and processing', 'Ensure biofuel product quality meets specifications', 'Coordinate biorefinery production schedules'],
    data_source: 'onet_green',
  },
  {
    code: '17-2199.11',
    title: 'Solar Energy Systems Engineers',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Solar system design and engineering', 'Photovoltaic technology', 'Solar thermal engineering', 'Grid interconnection design'],
    green_tasks: ['Design solar energy systems for residential and commercial applications', 'Engineer photovoltaic array layouts and configurations', 'Develop solar thermal collection and storage systems', 'Design grid interconnection systems for solar installations'],
    data_source: 'onet_green',
  },
  {
    code: '19-4099.01',
    title: 'Quality Control Analysts',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Biofuel quality testing', 'Renewable material testing', 'Environmental quality standards'],
    green_tasks: ['Test biofuel products for quality and composition', 'Analyze renewable energy materials for performance standards', 'Monitor environmental quality metrics for green production processes'],
    data_source: 'onet_green',
  },
  {
    code: '41-4011.07',
    title: 'Solar Sales Representatives and Assessors',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Solar energy assessment', 'PV system sizing', 'Solar financing and incentives', 'Customer energy analysis'],
    green_tasks: ['Assess customer properties for solar energy potential', 'Design and propose solar PV systems for customers', 'Explain solar financing options and government incentives', 'Calculate energy savings and return on investment for solar installations'],
    data_source: 'onet_green',
  },
  {
    code: '13-1199.01',
    title: 'Energy Auditors',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Building energy analysis', 'Thermal imaging', 'Energy modeling software', 'Utility rate analysis'],
    green_tasks: ['Conduct comprehensive energy audits of buildings and facilities', 'Use thermal imaging to identify energy loss points', 'Model building energy performance using simulation software', 'Recommend energy efficiency improvements with cost-benefit analysis'],
    data_source: 'onet_green',
  },
  {
    code: '17-2199.03',
    title: 'Energy Engineers, Except Mining and Geological',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Energy system optimization', 'Renewable energy integration', 'Energy efficiency engineering', 'Distributed energy resources'],
    green_tasks: ['Design energy-efficient systems for industrial and commercial facilities', 'Integrate renewable energy sources into existing power infrastructure', 'Develop energy management plans to reduce consumption', 'Engineer distributed energy resource systems'],
    data_source: 'onet_green',
  },
  {
    code: '11-9199.10',
    title: 'Biomass Power Plant Managers',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Biomass combustion systems', 'Feedstock logistics', 'Emissions control for biomass', 'Bioenergy facility management'],
    green_tasks: ['Manage operations of biomass power generation facilities', 'Coordinate biomass feedstock supply chain and logistics', 'Ensure compliance with emissions standards for biomass combustion', 'Optimize biomass conversion efficiency and plant output'],
    data_source: 'onet_green',
  },
  {
    code: '47-4099.02',
    title: 'Solar Thermal Installers and Technicians',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Solar thermal collector installation', 'Heat exchanger systems', 'Solar water heating', 'Thermal storage systems'],
    green_tasks: ['Install solar thermal collection systems on buildings', 'Connect solar thermal systems to domestic hot water supplies', 'Configure heat exchangers and thermal storage tanks', 'Maintain and repair solar thermal heating equipment'],
    data_source: 'onet_green',
  },
  {
    code: '49-9081.00',
    title: 'Wind Turbine Service Technicians',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Wind turbine maintenance', 'Turbine diagnostics', 'High-altitude safety', 'SCADA systems for wind'],
    green_tasks: ['Inspect and maintain wind turbine mechanical and electrical systems', 'Diagnose and repair wind turbine malfunctions', 'Perform scheduled maintenance on turbine components at height', 'Monitor turbine performance using SCADA systems'],
    data_source: 'onet_green',
  },
  {
    code: '13-1199.02',
    title: 'Sustainability Specialists',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Sustainability strategy', 'Environmental impact measurement', 'Stakeholder engagement', 'Circular economy implementation'],
    green_tasks: ['Develop and implement organizational sustainability strategies', 'Measure and report environmental impact metrics', 'Engage stakeholders on sustainability goals and progress', 'Design circular economy programs for waste reduction'],
    data_source: 'onet_green',
  },
  {
    code: '17-2199.09',
    title: 'Fuel Cell Engineers',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Hydrogen fuel cell design', 'Electrochemistry', 'Fuel cell stack engineering', 'Hydrogen storage systems'],
    green_tasks: ['Design and develop fuel cell systems for transportation and stationary power', 'Engineer hydrogen storage and delivery systems', 'Test and optimize fuel cell stack performance', 'Develop fuel cell manufacturing processes'],
    data_source: 'onet_green',
  },
  {
    code: '11-9199.08',
    title: 'Geothermal Production Managers',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Geothermal reservoir management', 'Steam field operations', 'Geothermal plant optimization', 'Subsurface resource management'],
    green_tasks: ['Manage geothermal power plant operations and production', 'Oversee geothermal well drilling and maintenance', 'Optimize geothermal reservoir utilization and sustainability', 'Coordinate steam field operations and pipeline maintenance'],
    data_source: 'onet_green',
  },
  {
    code: '19-2099.01',
    title: 'Remote Sensing Scientists and Technologists',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Satellite environmental monitoring', 'GIS for renewable energy siting', 'Climate remote sensing', 'Land use change detection'],
    green_tasks: ['Analyze satellite imagery for environmental monitoring', 'Use GIS to identify optimal sites for renewable energy projects', 'Monitor land use changes and deforestation via remote sensing', 'Develop remote sensing applications for climate research'],
    data_source: 'onet_green',
  },
  {
    code: '17-2199.02',
    title: 'Validation Engineers',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Green technology validation', 'Environmental performance testing', 'Clean energy system verification'],
    green_tasks: ['Validate performance of green energy systems and components', 'Test environmental compliance of new clean technologies', 'Verify energy efficiency claims for green products'],
    data_source: 'onet_green',
  },
  {
    code: '51-8099.01',
    title: 'Biofuels Processing Technicians',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Biofuel processing operations', 'Fermentation technology', 'Biodiesel production', 'Ethanol distillation'],
    green_tasks: ['Operate biofuel production and processing equipment', 'Monitor fermentation and chemical conversion processes', 'Produce biodiesel from vegetable oils and waste fats', 'Operate ethanol distillation and dehydration systems'],
    data_source: 'onet_green',
  },
  {
    code: '11-3051.02',
    title: 'Geothermal Production Managers',
    category: 'new_emerging',
    category_label: 'New & Emerging',
    green_skills: ['Geothermal energy management', 'Well field operations', 'Binary cycle plant operations', 'Geothermal resource assessment'],
    green_tasks: ['Direct operations of geothermal energy production facilities', 'Manage geothermal well field operations and maintenance', 'Oversee binary cycle and flash steam plant operations', 'Plan geothermal resource development and expansion'],
    data_source: 'onet_green',
  },
];

// ---------------------------------------------------------------------------
// Aggregated green skills across all occupations
// ---------------------------------------------------------------------------

function buildGreenSkillsIndex(): GreenSkill[] {
  const skillMap = new Map<string, { description: string; codes: Set<string>; category: GreenCategory }>();

  for (const occ of GREEN_OCCUPATIONS) {
    for (const skill of occ.green_skills) {
      const key = skill.toLowerCase();
      if (skillMap.has(key)) {
        skillMap.get(key)!.codes.add(occ.code);
      } else {
        skillMap.set(key, {
          description: skill,
          codes: new Set([occ.code]),
          category: occ.category,
        });
      }
    }
  }

  return [...skillMap.values()].map((entry) => ({
    name: entry.description,
    description: `Green skill relevant to ${entry.codes.size} occupation(s)`,
    occupation_codes: [...entry.codes],
    category: entry.category,
    data_source: 'onet_green' as const,
  }));
}

// ---------------------------------------------------------------------------
// Client class
// ---------------------------------------------------------------------------

export class OnetGreenClient {
  private occupations: GreenOccupation[] = GREEN_OCCUPATIONS;
  private skillsIndex: GreenSkill[] | null = null;

  private getSkillsIndex(): GreenSkill[] {
    if (!this.skillsIndex) {
      this.skillsIndex = buildGreenSkillsIndex();
    }
    return this.skillsIndex;
  }

  /**
   * List/filter green occupations by category and/or title search.
   */
  async getGreenOccupations(
    category?: GreenCategory,
    query?: string,
  ): Promise<{
    occupations: GreenOccupation[];
    total: number;
    filters_applied: { category?: string; query?: string };
    data_source: 'onet_green';
  }> {
    let results = this.occupations;

    if (category) {
      results = results.filter((o) => o.category === category);
    }

    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(
        (o) =>
          o.title.toLowerCase().includes(lowerQuery) ||
          o.code.includes(query) ||
          o.green_skills.some((s) => s.toLowerCase().includes(lowerQuery)) ||
          o.green_tasks.some((t) => t.toLowerCase().includes(lowerQuery)),
      );
    }

    return {
      occupations: results,
      total: results.length,
      filters_applied: {
        ...(category ? { category: CATEGORY_LABELS[category] } : {}),
        ...(query ? { query } : {}),
      },
      data_source: 'onet_green',
    };
  }

  /**
   * Get green-specific skills. If occupation code is provided, return skills
   * for that occupation. Otherwise return all green skills across the dataset.
   */
  async getGreenSkills(
    occupationCode?: string,
  ): Promise<{
    skills: GreenSkill[];
    total: number;
    occupation?: { code: string; title: string; category: string };
    data_source: 'onet_green';
  }> {
    if (occupationCode) {
      const occupation = this.occupations.find((o) => o.code === occupationCode);

      if (!occupation) {
        throw new Error(
          `No green occupation found for code: ${occupationCode}. Use onet_green_occupations to search available codes.`,
        );
      }

      const skills: GreenSkill[] = occupation.green_skills.map((skillName) => ({
        name: skillName,
        description: `Green skill for ${occupation.title}`,
        occupation_codes: [occupation.code],
        category: occupation.category,
        data_source: 'onet_green' as const,
      }));

      return {
        skills,
        total: skills.length,
        occupation: {
          code: occupation.code,
          title: occupation.title,
          category: occupation.category_label,
        },
        data_source: 'onet_green',
      };
    }

    // Return all green skills across all occupations
    const allSkills = this.getSkillsIndex();

    return {
      skills: allSkills,
      total: allSkills.length,
      data_source: 'onet_green',
    };
  }
}
