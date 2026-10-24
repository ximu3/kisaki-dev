using System.IO.Compression;
using System.Text.Json;
using LiteDB;

internal static class Program
{
    private static readonly HashSet<string> DatabaseNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "games.db", "completionstatuses.db", "categories.db", "tags.db", "genres.db",
        "features.db", "platforms.db", "series.db", "sources.db", "emulators.db",
        "ageratings.db", "companies.db", "regions.db"
    };

    public static int Main(string[] args)
    {
        try
        {
            if (args.Length == 0) return DumpDatabase(Console.OpenStandardInput());
            if (args.Length != 1) throw new ArgumentException("One input archive is required.");
            using var archive = ZipFile.OpenRead(args[0]);
            var databases = new Dictionary<string, Dictionary<string, List<BsonDocument>>>();
            int? version = null;
            foreach (var entry in archive.Entries)
            {
                var normalized = entry.FullName.Replace('\\', '/');
                if (normalized == "library/database.json")
                {
                    using var input = entry.Open();
                    using var info = JsonDocument.Parse(input);
                    if (info.RootElement.TryGetProperty("Version", out var item)) version = item.GetInt32();
                    continue;
                }
                if (!normalized.StartsWith("library/", StringComparison.OrdinalIgnoreCase)) continue;
                var relative = normalized["library/".Length..];
                if (relative.Contains('/') || !DatabaseNames.Contains(relative)) continue;
                using var source = entry.Open();
                using var data = new MemoryStream();
                source.CopyTo(data);
                using var readonlyData = new MemoryStream(data.ToArray(), writable: false);
                using var engine = new LiteEngine(new StreamDiskService(readonlyData), utcDate: true);
                var collections = new Dictionary<string, List<BsonDocument>>();
                foreach (var name in engine.GetCollectionNames()) collections[name] = engine.FindAll(name).ToList();
                databases.Add(relative, collections);
            }
            using var writer = new Utf8JsonWriter(Console.OpenStandardOutput(), new JsonWriterOptions { Indented = true });
            writer.WriteStartObject();
            writer.WriteNumber("databaseVersion", version ?? -1);
            writer.WriteString("liteDbVersion", typeof(LiteEngine).Assembly.GetName().Version?.ToString());
            writer.WriteBoolean("readonlyMemoryStreams", true);
            writer.WriteStartObject("databases");
            foreach (var database in databases)
            {
                writer.WriteStartObject(database.Key);
                foreach (var collection in database.Value) writer.WriteNumber(collection.Key, collection.Value.Count);
                writer.WriteEndObject();
            }
            writer.WriteEndObject();
            var games = databases.TryGetValue("games.db", out var gameCollections)
                ? gameCollections.SelectMany(x => x.Value).Where(x => x.ContainsKey("Name")).ToList()
                : new List<BsonDocument>();
            writer.WriteNumber("games", games.Count);
            writer.WriteStartObject("fieldTypes");
            foreach (var name in new[] { "GameId", "PluginId", "Playtime", "PlayCount", "UserScore", "Favorite", "Hidden", "CompletionStatusId", "LastActivity", "Added", "Notes", "Description", "GameActions", "InstallDirectory", "CoverImage", "Icon", "BackgroundImage", "Roms", "IncludeLibraryPluginAction" })
            {
                writer.WriteStartObject(name);
                foreach (var group in games.GroupBy(g => g.ContainsKey(name) ? g[name].Type.ToString() : "Missing"))
                    writer.WriteNumber(group.Key, group.Count());
                writer.WriteEndObject();
            }
            writer.WriteEndObject();
            writer.WriteStartObject("coverage");
            foreach (var name in new[] { "Notes", "Description", "InstallDirectory", "CoverImage", "Icon", "BackgroundImage" })
                writer.WriteNumber("nonempty" + name, games.Count(g => g.ContainsKey(name) && g[name].IsString && !string.IsNullOrWhiteSpace(g[name].AsString)));
            writer.WriteNumber("explicitActions", games.Sum(g => g.ContainsKey("GameActions") && g["GameActions"].IsArray ? g["GameActions"].AsArray.Count : 0));
            writer.WriteNumber("hasRoms", games.Count(g => g.ContainsKey("Roms") && g["Roms"].IsArray && g["Roms"].AsArray.Count > 0));

            var steamPlugin = Guid.Parse("CB91DFC9-B977-43BF-8E70-55F46E410FAB");
            writer.WriteNumber("steamIdentityRecords", games.Count(g => g.ContainsKey("PluginId") && g["PluginId"].IsGuid && g["PluginId"].AsGuid == steamPlugin && g.ContainsKey("GameId") && g["GameId"].IsString && ulong.TryParse(g["GameId"].AsString, out var id) && id > 0));
            writer.WriteNumber("otherLibraryIdentityRecords", games.Count(g => g.ContainsKey("PluginId") && g["PluginId"].IsGuid && g["PluginId"].AsGuid != Guid.Empty && g["PluginId"].AsGuid != steamPlugin));
            var actionDocuments = games.Where(g => g.ContainsKey("GameActions") && g["GameActions"].IsArray).SelectMany(g => g["GameActions"].AsArray).Where(a => a.IsDocument).Select(a => a.AsDocument).ToList();
            writer.WriteNumber("playActions", actionDocuments.Count(a => a.ContainsKey("IsPlayAction") && a["IsPlayAction"].IsBoolean && a["IsPlayAction"].AsBoolean));
            writer.WriteStartObject("actionTypes");
            foreach (var group in actionDocuments.GroupBy(a => a.ContainsKey("Type") ? a["Type"].ToString() : "Missing")) writer.WriteNumber(group.Key, group.Count());
            writer.WriteEndObject();
            writer.WriteStartObject("trackingModes");
            foreach (var group in actionDocuments.GroupBy(a => a.ContainsKey("TrackingMode") ? a["TrackingMode"].ToString() : "Missing")) writer.WriteNumber(group.Key, group.Count());
            writer.WriteEndObject();
            var zipNames = archive.Entries.ToDictionary(e => e.FullName.Replace('\\', '/'), StringComparer.OrdinalIgnoreCase);
            var imageRefs = games.SelectMany(g => new[] { "CoverImage", "Icon", "BackgroundImage" }.Where(key => g.ContainsKey(key) && g[key].IsString && !string.IsNullOrEmpty(g[key].AsString)).Select(key => g[key].AsString)).ToList();
            var foundImages = 0;
            var readImages = 0;
            var imageBytes = 0L;
            foreach (var reference in imageRefs)
            {
                var normalized = reference.Replace('\\', '/');
                if (normalized.StartsWith('/') || normalized.Contains(':') || normalized.Split('/').Any(p => p == "..")) continue;
                if (!zipNames.TryGetValue("libraryfiles/" + normalized, out var entry)) continue;
                foundImages++;
                using var imageStream = entry.Open();
                using var imageData = new MemoryStream();
                imageStream.CopyTo(imageData);
                if (imageData.Length == entry.Length) readImages++;
                imageBytes += imageData.Length;
            }
            writer.WriteNumber("imageReferences", imageRefs.Count);
            writer.WriteNumber("imageReferencesFound", foundImages);
            writer.WriteNumber("imageReferencesRead", readImages);
            writer.WriteNumber("imageBytesRead", imageBytes);

            writer.WriteEndObject();
            writer.WriteEndObject();
            writer.Flush();
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine("Read failed: " + error.GetType().FullName);
            return 1;
        }
    }

    private static int DumpDatabase(Stream input)
    {
        using var buffer = new MemoryStream();
        input.CopyTo(buffer);
        using var data = new MemoryStream(buffer.ToArray(), writable: false);
        using var engine = new LiteEngine(new StreamDiskService(data), utcDate: true);
        using var output = Console.OpenStandardOutput();
        foreach (var collection in engine.GetCollectionNames())
        foreach (var document in engine.FindAll(collection))
        {
            using var line = new MemoryStream();
            using (var writer = new Utf8JsonWriter(line))
            {
                writer.WriteStartObject();
                writer.WriteString("collection", collection);
                writer.WritePropertyName("document");
                WriteValue(writer, document);
                writer.WriteEndObject();
            }
            line.WriteTo(output);
            output.WriteByte((byte)'\n');
        }
        return 0;
    }

    private static void WriteTag(Utf8JsonWriter writer, string name, string value)
    {
        writer.WriteStartObject();
        writer.WriteString(name, value);
        writer.WriteEndObject();
    }

    private static void WriteValue(Utf8JsonWriter writer, BsonValue value)
    {
        switch (value.Type)
        {
            case BsonType.Null: writer.WriteNullValue(); break;
            case BsonType.Int32: writer.WriteNumberValue(value.AsInt32); break;
            case BsonType.Int64: WriteTag(writer, "$numberLong", value.AsInt64.ToString(System.Globalization.CultureInfo.InvariantCulture)); break;
            case BsonType.Double: writer.WriteNumberValue(value.AsDouble); break;
            case BsonType.Decimal: WriteTag(writer, "$numberDecimal", value.AsDecimal.ToString(System.Globalization.CultureInfo.InvariantCulture)); break;
            case BsonType.String: writer.WriteStringValue(value.AsString); break;
            case BsonType.Boolean: writer.WriteBooleanValue(value.AsBoolean); break;
            case BsonType.Guid: WriteTag(writer, "$guid", value.AsGuid.ToString()); break;
            case BsonType.DateTime: WriteTag(writer, "$date", value.AsDateTime.ToUniversalTime().ToString("O")); break;
            case BsonType.ObjectId: WriteTag(writer, "$oid", value.AsObjectId.ToString()); break;
            case BsonType.Binary: WriteTag(writer, "$binary", Convert.ToBase64String(value.AsBinary)); break;
            case BsonType.Array:
                writer.WriteStartArray();
                foreach (var item in value.AsArray) WriteValue(writer, item);
                writer.WriteEndArray();
                break;
            case BsonType.Document:
                writer.WriteStartObject();
                foreach (var item in value.AsDocument)
                {
                    writer.WritePropertyName(item.Key);
                    WriteValue(writer, item.Value);
                }
                writer.WriteEndObject();
                break;
            case BsonType.MinValue: WriteTag(writer, "$minKey", "1"); break;
            case BsonType.MaxValue: WriteTag(writer, "$maxKey", "1"); break;
            default: throw new InvalidDataException("Unsupported BSON value.");
        }
    }
}
