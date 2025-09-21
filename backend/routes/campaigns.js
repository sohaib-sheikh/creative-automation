const express = require('express');
const Campaign = require('../models/Campaign');
const router = express.Router();

// Get all campaigns with optional filtering
router.get('/', async (req, res) => {
  try {
    const { status, search, limit, offset } = req.query;
    
    let campaigns;
    let count;

    if (search) {
      campaigns = await Campaign.search(search);
      count = campaigns.length;
    } else {
      const options = {};
      if (status) options.status = status;
      if (limit) options.limit = parseInt(limit);
      if (offset) options.offset = parseInt(offset);
      
      campaigns = await Campaign.findAll(options);
      count = await Campaign.count({ status });
    }

    res.json({
      success: true,
      campaigns,
      count,
      message: 'Campaigns retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns',
      details: error.message
    });
  }
});

// Get campaign by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      campaign,
      message: 'Campaign retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign',
      details: error.message
    });
  }
});

// Create new campaign
router.post('/', async (req, res) => {
  try {
    const { brief, assets, generatedCreatives, status } = req.body;

    // Validate required fields
    if (!brief) {
      return res.status(400).json({
        success: false,
        error: 'Campaign brief is required'
      });
    }

    const campaignData = {
      brief,
      assets: assets || [],
      generatedCreatives: generatedCreatives || [],
      status: status || 'draft'
    };

    const campaign = await Campaign.create(campaignData);

    res.status(201).json({
      success: true,
      campaign,
      message: 'Campaign created successfully'
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create campaign',
      details: error.message
    });
  }
});

// Update campaign
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    const updatedCampaign = await campaign.update(updates);

    res.json({
      success: true,
      campaign: updatedCampaign,
      message: 'Campaign updated successfully'
    });
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update campaign',
      details: error.message
    });
  }
});

// Delete campaign
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    await campaign.delete();

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete campaign',
      details: error.message
    });
  }
});

// Get campaigns by status
router.get('/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    
    // Validate status
    if (!['draft', 'generated', 'published'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: draft, generated, published'
      });
    }

    const campaigns = await Campaign.findByStatus(status);
    const count = await Campaign.count({ status });

    res.json({
      success: true,
      campaigns,
      count,
      message: `Campaigns with status '${status}' retrieved successfully`
    });
  } catch (error) {
    console.error('Error fetching campaigns by status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns by status',
      details: error.message
    });
  }
});

// Search campaigns
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const campaigns = await Campaign.search(query.trim());

    res.json({
      success: true,
      campaigns,
      count: campaigns.length,
      message: `Found ${campaigns.length} campaigns matching '${query}'`
    });
  } catch (error) {
    console.error('Error searching campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search campaigns',
      details: error.message
    });
  }
});

// Delete a specific generated creative from a campaign
router.delete('/:campaignId/creatives/:creativeId', async (req, res) => {
  try {
    const { campaignId, creativeId } = req.params;

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Find the creative to delete
    const creativeIndex = campaign.generatedCreatives.findIndex(creative => creative.id === creativeId);
    if (creativeIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Generated creative not found'
      });
    }

    // Remove the creative from the array
    const updatedCreatives = campaign.generatedCreatives.filter(creative => creative.id !== creativeId);
    
    // Update the campaign with the new creatives array
    await campaign.update({ generatedCreatives: updatedCreatives });

    res.json({
      success: true,
      message: 'Generated creative deleted successfully',
      deletedCreativeId: creativeId
    });
  } catch (error) {
    console.error('Error deleting generated creative:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete generated creative',
      details: error.message
    });
  }
});

// Get campaign statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const totalCampaigns = await Campaign.count();
    const draftCampaigns = await Campaign.count({ status: 'draft' });
    const generatedCampaigns = await Campaign.count({ status: 'generated' });
    const publishedCampaigns = await Campaign.count({ status: 'published' });

    res.json({
      success: true,
      stats: {
        total: totalCampaigns,
        draft: draftCampaigns,
        generated: generatedCampaigns,
        published: publishedCampaigns
      },
      message: 'Campaign statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching campaign statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign statistics',
      details: error.message
    });
  }
});

module.exports = router;
