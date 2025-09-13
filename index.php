<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// MongoDB configuration
$mongoUri = 'mongodb://localhost:27017';
$databaseName = 'survey_db';
$collectionName = 'surveys';

try {
    // Connect to MongoDB
    $client = new MongoDB\Client($mongoUri);
    $database = $client->selectDatabase($databaseName);
    $collection = $database->selectCollection($collectionName);
    
    // Test connection
    $client->listDatabases();
} catch (MongoDB\Driver\Exception\ConnectionException $e) {
    die(json_encode(['error' => 'MongoDB connection failed: ' . $e->getMessage()]));
} catch (Exception $e) {
    die(json_encode(['error' => 'Database error: ' . $e->getMessage()]));
}

// Handle GET request - fetch all surveys
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $cursor = $collection->find([], ['sort' => ['created_at' => -1]]);
        $surveys = [];
        
        foreach ($cursor as $document) {
            $surveys[] = [
                '_id' => (string)$document['_id'],
                'question' => $document['question'],
                'options' => $document['options'],
                'created_at' => $document['created_at']->toDateTime()->format('c')
            ];
        }
        
        echo json_encode($surveys);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Failed to fetch surveys: ' . $e->getMessage()]);
    }
}

// Handle POST request
elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        echo json_encode(['error' => 'Invalid JSON input']);
        exit;
    }
    
    // Handle vote submission
    if (isset($input['action']) && $input['action'] === 'vote' && isset($input['survey_id']) && isset($input['option_index'])) {
        try {
            $surveyId = new MongoDB\BSON\ObjectId($input['survey_id']);
            $optionIndex = (int)$input['option_index'];
            
            // Increment vote count for the specific option
            $result = $collection->updateOne(
                ['_id' => $surveyId],
                ['$inc' => ["options.$optionIndex.votes" => 1]]
            );
            
            if ($result->getModifiedCount() === 0) {
                throw new Exception('Survey not found or option index invalid');
            }
            
            // Get updated survey data
            $updatedSurvey = $collection->findOne(['_id' => $surveyId]);
            $updatedOption = $updatedSurvey['options'][$optionIndex];
            
            echo json_encode([
                'success' => true, 
                'votes' => $updatedOption['votes'],
                'total_votes' => array_sum(array_column($updatedSurvey['options'], 'votes'))
            ]);
        } catch (Exception $e) {
            echo json_encode(['error' => 'Failed to record vote: ' . $e->getMessage()]);
        }
    }
    
    // Handle survey creation
    elseif (isset($input['action']) && $input['action'] === 'create_survey') {
        if (!isset($input['question']) || !isset($input['options']) || count($input['options']) < 2) {
            echo json_encode(['error' => 'Survey must have a question and at least 2 options']);
            exit;
        }
        
        try {
            // Prepare options array with votes initialized to 0
            $options = [];
            foreach ($input['options'] as $optionText) {
                if (trim($optionText) !== '') {
                    $options[] = [
                        'text' => trim($optionText),
                        'votes' => 0
                    ];
                }
            }
            
            if (count($options) < 2) {
                echo json_encode(['error' => 'Survey must have at least 2 valid options']);
                exit;
            }
            
            // Create survey document
            $surveyDocument = [
                'question' => trim($input['question']),
                'options' => $options,
                'created_at' => new MongoDB\BSON\UTCDateTime()
            ];
            
            $result = $collection->insertOne($surveyDocument);
            $surveyId = (string)$result->getInsertedId();
            
            echo json_encode(['success' => true, 'survey_id' => $surveyId]);
        } catch (Exception $e) {
            echo json_encode(['error' => 'Failed to create survey: ' . $e->getMessage()]);
        }
    }
    
    else {
        echo json_encode(['error' => 'Invalid action']);
    }
}

else {
    echo json_encode(['error' => 'Method not allowed']);
}
?>
