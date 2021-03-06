package uk.ac.susx.shl.micromacro.core.data.geo;


import com.google.common.collect.Sets;
import com.vividsolutions.jts.geom.Coordinate;
import com.vividsolutions.jts.geom.GeometryFactory;
import com.vividsolutions.jts.geom.Point;
import me.xdrop.fuzzywuzzy.FuzzySearch;
import me.xdrop.fuzzywuzzy.algorithms.WeightedRatio;
import me.xdrop.fuzzywuzzy.model.ExtractedResult;
import org.geotools.feature.FeatureCollection;
import org.geotools.feature.FeatureIterator;
import org.geotools.geojson.GeoJSONUtil;
import org.geotools.geojson.feature.FeatureJSON;
import org.geotools.geojson.geom.GeometryJSON;
import org.geotools.geometry.jts.JTS;
import org.opengis.feature.Feature;
import org.geotools.referencing.CRS;
import org.opengis.feature.simple.SimpleFeature;
import org.opengis.geometry.BoundingBox;
import org.opengis.referencing.FactoryException;
import org.opengis.referencing.crs.CoordinateReferenceSystem;
import org.opengis.referencing.operation.MathTransform;
import org.opengis.referencing.operation.TransformException;
import uk.ac.susx.shl.micromacro.core.data.text.Candidate;
import uk.ac.susx.shl.micromacro.core.data.KnowledegeBase;
import uk.ac.susx.shl.micromacro.core.data.Match;

import java.io.IOException;
import java.io.Reader;
import java.nio.file.Path;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Created by sw206 on 16/04/2018.
 */
public class GeoJsonKnowledgeBase implements KnowledegeBase {

    private final Map<String, List<Map>> data;
    private final List<String> keyList;
    private final Map<String, Set<String>> keyLetters;

    private Pattern parenetheses = Pattern.compile("\\(.*\\)");

    public GeoJsonKnowledgeBase(Path path) throws IOException {
        data = load(path);
        keyList = new ArrayList<>(data.keySet());
        keyLetters = new HashMap<>();
        for(String key : keyList) {

            keyLetters.put(key, getStringSet(key));
        }
    }

    private Set<String> getStringSet(String string) {
        return new HashSet<>(Arrays.asList(string.toLowerCase().split("")));
    }

    private Map<String, List<Map>> load(Path path) throws IOException {

        Reader reader = GeoJSONUtil.toReader(path.toFile());

        GeometryJSON gjson = new GeometryJSON();

        FeatureJSON fjson = new FeatureJSON(gjson);

        FeatureCollection fc = fjson.readFeatureCollection(reader);

        CoordinateReferenceSystem crs = fc.getSchema().getCoordinateReferenceSystem();

        GeometryFactory gf = new GeometryFactory();

        try {

            MathTransform transform = CRS.findMathTransform(crs, CRS.decode("EPSG:4326"));

            FeatureIterator itr = fc.features();

            Map<String, List<Map>> data = new HashMap<>();

            while(itr.hasNext()) {
                Feature f = itr.next();

                String name = (String)f.getProperty("P_NAME").getValue();

                name = parenetheses.matcher(name).replaceAll("")
                    .replace("[", "")
                    .replace("]", "");

                BoundingBox bb = f.getBounds();

                try {

                    Point target = (Point)JTS.transform(gf.createPoint(new Coordinate(bb.getMedian(0), bb.getMedian(1))), transform );

                    Map<String, String> datum = new HashMap<>();

                    datum.put("lat", Double.toString(target.getX()));
                    datum.put("lng", Double.toString(target.getY()));

                    datum.put("NAME", (String)((SimpleFeature) f).getAttribute("NAME"));
                    datum.put("NAME_1", (String)((SimpleFeature) f).getAttribute("NAME_1"));

                    if(!data.containsKey(name)) {
                        data.put(name, new ArrayList<>());
                    }

                    data.get(name).add(datum);
                } catch (TransformException e) {

                }
            }

            return data;
        } catch (FactoryException e) {

            throw new RuntimeException(e);
        }
    }

    private List<String> filterKeys(String target) {
        Set<String> targetLetters = getStringSet(target);
        List<String> keys = new ArrayList<>();
        for(String key : keyList) {
            Set<String> keyLetters = this.keyLetters.get(key);
            Set<String> intersection = Sets.intersection(targetLetters, keyLetters);
            double sim = intersection.size()/(double)targetLetters.size();
            if(sim > 0.5){
                keys.add(key);
            }
        }
        return keys;
    }


    //https://github.com/tdebatty/java-string-similarity maybe this?
    public List<Match> getMatches(String candidate) {
        return getMatches(Candidate.of(candidate));
    }
    public List<Match> getMatches(Candidate candidate) {

        String text = candidate.getText();

        List<String> keys = filterKeys(text);

        List<ExtractedResult> top = FuzzySearch.extractTop(text, keys, new WeightedRatio(),1);
//        List<ExtractedResult> top = FuzzySearch.extractTop(text, keys, new WeightedRatio(),10);

        List<Match> matches = new ArrayList<>();

        for(ExtractedResult result : top) {
            String name = keys.get(result.getIndex());

            int score = result.getScore();
            if(score > 86) {
                for(Map details : data.get(name)) {
                    matches.add(Match.of(name, candidate, score, details));
                }
            }

        }

        return matches;
    }
}
